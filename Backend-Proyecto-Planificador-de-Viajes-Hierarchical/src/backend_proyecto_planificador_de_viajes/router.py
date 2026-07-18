# ============================================================================
# ROUTER: decide qué hacer con el mensaje del usuario ANTES de tocar el Crew.
# ============================================================================
# Vive fuera de TravelCrew (crew.py) a propósito: el Crew jerárquico (6 agentes
# + manager) es costoso y solo tiene sentido cuando el usuario pide armar un
# viaje/itinerario completo. Para saludos o preguntas puntuales, este router
# resuelve la respuesta sin instanciar el Crew.
#
# 3 categorías posibles:
#   - "chat"             -> saludo o charla sin relación con viajes.
#   - "consulta_puntual"  -> pregunta puntual de viajes (comida típica, clima...)
#                            que NO pide armar un itinerario completo.
#   - "plan_completo"     -> pide planear/organizar un viaje -> dispara TravelCrew.
# ============================================================================

import asyncio
import os
from pathlib import Path
from typing import Literal

import yaml
from crewai import LLM, Agent, Crew, Process, Task
from pydantic import BaseModel, Field
from tavily import TavilyClient

from .tools.busqueda_internet_tool import TavilyInternetSearchTool


# --- Esquema que ve y llena el LLM (output_pydantic del Task) ---------------
# Sin imagen_url a propósito: si el campo existiera acá, el LLM tendría que
# "inventar" una URL (alucinación garantizada). Las imágenes se resuelven
# aparte, después, con una búsqueda real en Tavily (ver _agregar_imagenes).
class _ItemRecomendadoLLM(BaseModel):
    """Un lugar, plato u opción recomendada dentro de una consulta_puntual.
    'nombre' se usa tal cual para buscarle una imagen real, así que debe ser
    corto y concreto (ej: 'Huaca Pucllana', no una frase completa)."""

    nombre: str = Field(description="Nombre corto y concreto (2-5 palabras)")
    descripcion: str = Field(description="Descripción breve, 1-3 frases")


class _RespuestaConsultaPuntualLLM(BaseModel):
    """Salida estructurada que debe producir el Agent (ver output_pydantic en
    responder_consulta_puntual). No toda consulta_puntual es una lista de
    lugares (ej: '¿es seguro viajar sola a Perú?'), por eso 'items' puede
    quedar vacío y toda la respuesta ir en 'intro'."""

    intro: str = Field(default="", description="Texto libre antes de la lista, si aplica")
    destino: str = Field(
        default="",
        description=(
            "Ciudad o destino principal al que se refiere la respuesta (ej: 'Lima', "
            "'Cusco'). Vacío si la respuesta no está atada a un destino concreto. Se usa "
            "para buscar mejores imágenes de cada item, no se muestra directamente."
        ),
    )
    items: list[_ItemRecomendadoLLM] = Field(
        default_factory=list,
        description=(
            "Lugares, platos u opciones recomendadas, SOLO si la pregunta pide una "
            "lista de ese tipo. Vacío si la respuesta es un dato puntual (precio, "
            "clima, sí/no, etc.) que no tiene sentido partir en items."
        ),
    )
    cierre: str = Field(default="", description="Texto de cierre o consejos finales, si aplica")


# --- Esquema público (lo que devuelve responder_consulta_puntual / la API) --
# Igual al de arriba pero con imagen_url ya resuelta por Tavily en cada item.
class ItemRecomendado(BaseModel):
    nombre: str
    descripcion: str
    imagen_url: str | None = None


class RespuestaConsultaPuntual(BaseModel):
    intro: str = ""
    items: list[ItemRecomendado] = Field(default_factory=list)
    cierre: str = ""


def _buscar_imagen_url(query: str) -> str | None:
    """Busca en Tavily una imagen real relacionada con `query` (ej: 'Huaca
    Pucllana Lima'). A diferencia de la foto por palabras clave que usaba el
    frontend (LoremFlickr), esta imagen sale de una página que Tavily
    encontró hablando específicamente de ese lugar/plato. Devuelve None ante
    cualquier error o si no hay resultados (el frontend hace fallback)."""
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return None
    try:
        respuesta = TavilyClient(api_key=api_key).search(
            query=query,
            search_depth="basic",
            max_results=1,
            include_images=True,
        )
        imagenes = respuesta.get("images") or []
        if not imagenes:
            return None
        primera = imagenes[0]
        # La API devuelve strings (URLs) o, con include_image_descriptions,
        # objetos {"url": ...}: cubrimos ambos casos.
        return primera if isinstance(primera, str) else primera.get("url")
    except Exception:
        return None


async def _agregar_imagenes(resp_llm: _RespuestaConsultaPuntualLLM) -> RespuestaConsultaPuntual:
    """Convierte la respuesta del LLM (sin imágenes) en la respuesta pública
    (con imagen_url), buscando en Tavily una imagen por item EN PARALELO
    (TavilyClient.search es síncrono/bloqueante, por eso asyncio.to_thread)."""
    queries = [f"{item.nombre} {resp_llm.destino}".strip() for item in resp_llm.items]
    urls = await asyncio.gather(*(asyncio.to_thread(_buscar_imagen_url, q) for q in queries))
    items = [
        ItemRecomendado(nombre=item.nombre, descripcion=item.descripcion, imagen_url=url)
        for item, url in zip(resp_llm.items, urls)
    ]
    return RespuestaConsultaPuntual(intro=resp_llm.intro, items=items, cierre=resp_llm.cierre)


def formatear_respuesta(resp: RespuestaConsultaPuntual) -> str:
    """Aplana la respuesta estructurada a markdown, para guardar en Supabase
    y mostrar en el chat (el frontend además usa `items` por separado para
    mostrar una imagen junto a cada lugar/plato)."""
    partes: list[str] = []
    if resp.intro.strip():
        partes.append(resp.intro.strip())
    if resp.items:
        partes.append(
            "\n".join(f"- **{item.nombre}**: {item.descripcion}" for item in resp.items)
        )
    if resp.cierre.strip():
        partes.append(resp.cierre.strip())
    return "\n\n".join(partes)

Categoria = Literal["chat", "consulta_puntual", "plan_completo"]
CATEGORIAS: tuple[Categoria, ...] = ("chat", "consulta_puntual", "plan_completo")

# Áreas en las que se puede especializar una consulta_puntual. Cada una reusa
# el "role"/"backstory" (persona) del agente equivalente del Crew completo,
# leídos directamente de config/agents.yaml (misma fuente que usa TravelCrew
# en crew.py) para que no se desincronicen si se edita ese archivo. El "goal"
# SÍ se reescribe a propósito para cada área: el de agents.yaml está orientado
# a "armar el itinerario del viaje" (usa el placeholder {trip_request}, que
# solo CrewAI interpola dentro de Crew.kickoff(inputs=...) — aquí no aplica,
# no hay un "viaje" completo, solo una pregunta puntual), mientras que aquí
# necesitamos un objetivo de "responder una pregunta y listo".
Area = Literal["cultura", "gastronomia", "logistica", "general"]
AREAS: tuple[Area, ...] = ("cultura", "gastronomia", "logistica", "general")

# Historial de conversación: lista de turnos previos {"role": "user"|"assistant",
# "content": "..."}. main.py lo carga desde Supabase (tabla chat_messages,
# ver db.py) antes de llamar a estas funciones, agrupado por session_id.
# Sin esto, el clasificador y los agentes "olvidan" lo dicho en mensajes
# anteriores (ej: el destino mencionado 2 mensajes atrás).
Historial = list[dict[str, str]]

_AGENTS_YAML_PATH = Path(__file__).parent / "config" / "agents.yaml"
_AGENTS_CONFIG: dict = yaml.safe_load(_AGENTS_YAML_PATH.read_text(encoding="utf-8"))

# area -> (clave del agente en agents.yaml, goal a usar en modo consulta_puntual)
_AREA_A_AGENTE: dict[Area, tuple[str | None, str]] = {
    "cultura": (
        "agente_experto_cultural",
        "Responder preguntas puntuales sobre atracciones culturales, historia, arte y "
        "sitios imperdibles de un destino, sin armar un itinerario completo.",
    ),
    "gastronomia": (
        "agente_gourmet_local",
        "Responder preguntas puntuales sobre comida típica, restaurantes y experiencias "
        "gastronómicas de un destino, sin armar un itinerario completo.",
    ),
    "logistica": (
        "agente_logistica",
        "Responder preguntas puntuales sobre vuelos, alojamiento, transporte y presupuesto "
        "de un viaje, sin armar un itinerario completo.",
    ),
    # No existe un agente "general" en el Crew completo: es un perfil propio
    # del router para preguntas que no encajan en las 3 áreas anteriores.
    "general": (
        None,
        "Responder preguntas puntuales sobre viajes de forma precisa y concisa, "
        "usando la búsqueda en internet cuando la pregunta lo requiera.",
    ),
}


def _limpiar(texto: str) -> str:
    """agents.yaml usa bloques '>' con comillas literales (ej. \"'Experto...'\\n\");
    esto deja el texto listo para usar como role/backstory de un Agent."""
    return texto.strip().strip("'\"").strip()


def _construir_personas() -> dict[Area, dict[str, str]]:
    personas: dict[Area, dict[str, str]] = {}
    for area, (agente_key, goal) in _AREA_A_AGENTE.items():
        if agente_key is None:
            personas[area] = dict(
                role="Asistente de Viajes",
                goal=goal,
                backstory=(
                    "Un asistente de viajes con acceso a internet, especializado en "
                    "responder preguntas puntuales (clima, seguridad, cultura general) sin "
                    "necesidad de armar un itinerario completo. Va directo al grano."
                ),
            )
            continue
        config = _AGENTS_CONFIG[agente_key]
        personas[area] = dict(
            role=_limpiar(config["role"]),
            goal=goal,
            backstory=_limpiar(config["backstory"]),
        )
    return personas


PERSONAS: dict[Area, dict[str, str]] = _construir_personas()


def _llm() -> LLM:
    # Mismo modelo que el resto del proyecto (variable MODEL del .env).
    return LLM(model=os.getenv("MODEL", "gpt-4o-mini"))


def _mensajes_previos(history: Historial | None) -> list[dict[str, str]]:
    """Convierte el historial (cargado por main.py desde Supabase) en mensajes
    válidos para LLM.call() (solo role user/assistant, se descarta lo demás)."""
    if not history:
        return []
    return [
        {"role": turno["role"], "content": turno["content"]}
        for turno in history
        if turno.get("role") in ("user", "assistant") and turno.get("content")
    ]


def contexto_como_texto(history: Historial | None) -> str:
    """Aplana el historial a texto plano, para pegarlo dentro de un Task
    description o del trip_request del Crew (que no soportan chat multi-turno,
    solo un string)."""
    mensajes = _mensajes_previos(history)
    if not mensajes:
        return ""
    etiquetas = {"user": "Usuario", "assistant": "Asistente"}
    lineas = [f"{etiquetas[m['role']]}: {m['content']}" for m in mensajes]
    return "\n".join(lineas)


def clasificar_mensaje(prompt: str, history: Historial | None = None) -> Categoria:
    """1 sola llamada al LLM: decide en qué categoría cae el mensaje del usuario."""
    system = (
        "Clasificas mensajes de un chatbot de viajes en EXACTAMENTE una palabra, "
        "sin explicaciones ni puntuación adicional:\n"
        "- 'chat': saludos, charla sin relación con viajes, O expresiones vagas de interés en "
        "viajar/conocer un lugar que NO incluyen una pregunta concreta ni piden armar un plan "
        "(ej: 'hola', 'cómo estás', 'me gustaría ir a Cusco algún día', 'quiero conocer Perú').\n"
        "- 'consulta_puntual': pregunta puntual y concreta sobre viajes que NO pide armar un "
        "itinerario completo (ej: 'platos típicos de Perú', 'clima en Cusco en agosto', "
        "'qué museos hay en Cusco').\n"
        "- 'plan_completo': pide EXPLÍCITAMENTE planear/organizar un viaje o itinerario PARA UN "
        "DESTINO CONCRETO YA DECIDIDO, casi siempre con datos como fechas o duración, o pidiendo "
        "directamente un 'plan'/'itinerario' (ej: 'quiero viajar a Cusco del 10 al 15 de agosto', "
        "'arma un plan de 3 días en Lima', 'organízame un itinerario para mi viaje a Cusco').\n"
        "IMPORTANTE - NO es 'plan_completo' (usa 'chat' o 'consulta_puntual' en su lugar):\n"
        "  - Si el mensaje solo menciona un destino con interés o deseo, sin fechas, duración "
        "ni pedir explícitamente un plan/itinerario (ej: 'me gustaría ir a Cusco algún día') "
        "-> 'chat', para invitar a dar más detalles.\n"
        "  - Si el mensaje da duración/fechas/estilo de viaje (ej: 'viajo sola', '3 días') pero "
        "NO da un destino concreto y pide recomendaciones o ideas de lugares/destinos (ej: "
        "'dime lugares que podría visitar en 3 días', 'a dónde puedo viajar sola un fin de "
        "semana') -> 'consulta_puntual', porque es un pedido de recomendaciones, no un "
        "itinerario día a día de un lugar ya elegido.\n"
        "Responde SOLO con una de esas 3 palabras, nada más. Si hay mensajes anteriores en la "
        "conversación, úsalos como contexto (ej: si ya se mencionó un destino antes y ahora el "
        "usuario da fechas, eso SÍ cuenta como destino concreto)."
    )
    respuesta = _llm().call(
        messages=[
            {"role": "system", "content": system},
            *_mensajes_previos(history),
            {"role": "user", "content": prompt},
        ]
    )
    categoria = respuesta.strip().lower().strip("'\".")
    return categoria if categoria in CATEGORIAS else "chat"


def clasificar_area(prompt: str, history: Historial | None = None) -> Area:
    """1 sola llamada al LLM: decide qué especialista debe responder una consulta_puntual."""
    system = (
        "Clasificas una pregunta puntual de viajes en EXACTAMENTE una palabra, sin "
        "explicaciones ni puntuación adicional:\n"
        "- 'cultura': preguntas sobre atracciones, museos, historia, sitios turísticos "
        "(ej: 'qué ver en Cusco', 'sitios históricos en Roma').\n"
        "- 'gastronomia': preguntas sobre comida típica, restaurantes, bebidas "
        "(ej: 'qué comer en Lima', 'mejores restaurantes en Cusco').\n"
        "- 'logistica': preguntas sobre vuelos, hoteles, transporte, presupuesto, documentación "
        "(ej: 'cuánto cuesta un vuelo a Cusco', 'cómo moverme por Lima').\n"
        "- 'general': cualquier otra pregunta de viajes que no encaje claramente en las "
        "anteriores (ej: 'clima en Cusco en agosto', 'es seguro viajar solo a Perú').\n"
        "Responde SOLO con una de esas 4 palabras, nada más."
    )
    respuesta = _llm().call(
        messages=[
            {"role": "system", "content": system},
            *_mensajes_previos(history),
            {"role": "user", "content": prompt},
        ]
    )
    area = respuesta.strip().lower().strip("'\".")
    return area if area in AREAS else "general"


def responder_chat(prompt: str, history: Historial | None = None) -> str:
    """Charla simple: sin tools, sin Crew. Para saludos o mensajes sin relación con viajes."""
    system = (
        "Eres el asistente conversacional de un planificador de viajes con IA. "
        "Responde de forma breve, cálida y amable. Si la charla se presta, invita a la "
        "persona a contarte su próximo destino para ayudarle a planear el viaje. Ten en "
        "cuenta los mensajes anteriores de la conversación para no perder el contexto "
        "(ej: destinos o preferencias que el usuario ya mencionó)."
    )
    return _llm().call(
        messages=[
            {"role": "system", "content": system},
            *_mensajes_previos(history),
            {"role": "user", "content": prompt},
        ]
    )


async def responder_consulta_puntual(
    prompt: str, fecha_actual: str, history: Historial | None = None
) -> RespuestaConsultaPuntual:
    """
    Pregunta puntual de viajes (sin pedir itinerario completo): 1 solo Agent con
    la tool de búsqueda (Tavily), en vez de disparar el Crew completo de 6 agentes.

    El Agent usa la "persona" (role/goal/backstory) del especialista más adecuado
    a la pregunta (cultura, gastronomía, logística o general), detectado con una
    llamada extra al LLM (clasificar_area), en vez de responder siempre con un
    perfil genérico.
    """
    area = clasificar_area(prompt, history)
    print(f"🧑‍🔬 Área detectada: {area}")
    persona = PERSONAS[area]

    agente = Agent(
        role=persona["role"],
        goal=persona["goal"],
        backstory=persona["backstory"],
        tools=[TavilyInternetSearchTool()],
        verbose=True,
    )

    # Los Task de CrewAI no soportan chat multi-turno (solo un string de
    # descripción), así que el historial se aplana como contexto de texto.
    contexto = contexto_como_texto(history)
    contexto_bloque = (
        f"Contexto de la conversación hasta ahora:\n{contexto}\n\n" if contexto else ""
    )

    tarea = Task(
        description=(
            f"Hoy es {fecha_actual}. {contexto_bloque}"
            f"Responde de forma clara y concisa la siguiente "
            f'pregunta relacionada con viajes: "{prompt}". '
            "Usa la búsqueda en internet si necesitas datos actualizados."
        ),
        expected_output=(
            "Una respuesta directa y bien fundamentada a la pregunta del usuario, en el "
            "formato estructurado pedido (intro/items/cierre). Si la pregunta pide lugares, "
            "comidas, hoteles o cualquier otra lista de opciones, cada opción va como un "
            "item separado con un 'nombre' corto (para poder buscarle una foto) y su "
            "'descripcion'. Si NO es una pregunta de tipo lista, deja 'items' vacío y "
            "responde todo en 'intro'."
        ),
        agent=agente,
        output_pydantic=_RespuestaConsultaPuntualLLM,
    )

    crew = Crew(agents=[agente], tasks=[tarea], process=Process.sequential, verbose=True, tracing=False)
    resultado = await crew.kickoff_async()
    resp_llm = (
        resultado.pydantic
        if resultado.pydantic is not None
        # Fallback defensivo por si el LLM no logró producir el JSON estructurado.
        else _RespuestaConsultaPuntualLLM(intro=resultado.raw)
    )
    return await _agregar_imagenes(resp_llm)
