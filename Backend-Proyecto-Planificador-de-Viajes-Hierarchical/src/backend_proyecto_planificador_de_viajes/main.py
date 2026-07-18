# src/travel_crew_backend/main.py

import asyncio
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel
from starlette.responses import JSONResponse
from datetime import date

# Usamos una importación relativa porque 'crew.py' está en el mismo directorio.
from .crew import TravelCrew
from .router import (
    clasificar_mensaje,
    clasificar_area,
    responder_chat,
    responder_consulta_puntual,
    contexto_como_texto,
    formatear_respuesta,
    PERSONAS,
)
from . import db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_pool()
    yield
    await db.close_pool()


# Inicializar la aplicación FastAPI
app = FastAPI(
    title="API del Asistente de Viajes",
    description="Una API para planificar itinerarios de viaje personalizados usando un equipo de agentes de IA (CrewAI).",
    version="1.0.0",
    lifespan=lifespan,
)

class TripRequest(BaseModel):
    prompt: str
    # UUID generado por el frontend (una vez por navegador, guardado en
    # localStorage) que agrupa los mensajes de esta conversación en Supabase.
    # El backend no tiene sesión propia: usa esto para cargar el historial
    # antes de responder y guardar cada turno nuevo.
    session_id: uuid.UUID

# --- Función de Limpieza ---
# Esta función eliminará los artefactos comunes del LLM
def clean_llm_output(text: str) -> str:
    cleaned_text = text.replace("∗", "").replace("ˊ", "")
    # Puedes añadir más reemplazos si encuentras otros artefactos
    return cleaned_text

@app.get("/history/{session_id}")
async def get_history_endpoint(session_id: uuid.UUID):
    """Historial de una conversación (para restaurar el chat al recargar la página)."""
    return {"history": await db.fetch_history(session_id)}

@app.post("/clasificar")
async def clasificar_endpoint(request: TripRequest):
    """
    Clasificación rápida (1-2 llamadas cortas al LLM, sin tools ni Crew) para
    que el frontend sepa QUÉ va a pasar antes de llamar a /plan-trip, y así
    muestre el loader correcto (chat/consulta puntual con 1 agente, o el
    Crew de 6 agentes) en vez de adivinar por cuánto tiempo lleva esperando.
    /plan-trip vuelve a clasificar por su cuenta (es la llamada autoritativa
    que efectivamente ejecuta la respuesta); esta llamada es solo para la UI,
    así que ambos endpoints no comparten estado y pueden llamarse en paralelo.
    """
    history = await db.fetch_history(request.session_id)
    categoria = await asyncio.to_thread(clasificar_mensaje, request.prompt, history)

    agente = None
    if categoria == "consulta_puntual":
        area = await asyncio.to_thread(clasificar_area, request.prompt, history)
        agente = PERSONAS[area]["role"]

    return {"categoria": categoria, "agente": agente}

@app.post("/plan-trip") #Primer Endpoint.
async def plan_trip_endpoint(request: TripRequest):
    """
    Recibe una petición de viaje y devuelve un itinerario generado por el Crew de IA,
    listo para mostrarse en el chat y para ser descargado.
    """
    try:
        fecha_actual = date.today().isoformat()
        session_id = request.session_id

        # Historial guardado en Supabase de esta conversación (turnos previos,
        # sin incluir el prompt actual). Se guarda el turno del usuario ya
        # mismo: así queda registrado aunque la respuesta falle más abajo.
        history = await db.fetch_history(session_id)
        await db.save_message(session_id, "user", request.prompt)

        # --- ROUTER ---
        # Antes de instanciar el Crew (6 agentes + manager, costoso), 1 sola
        # llamada al LLM decide qué tipo de mensaje es. LLM.call() es síncrono
        # (bloqueante), así que lo corremos en un thread aparte para no
        # congelar el event loop de FastAPI mientras responde.
        categoria = await asyncio.to_thread(clasificar_mensaje, request.prompt, history)
        print(f"🧭 Categoría detectada: {categoria}")

        if categoria == "chat":
            respuesta = await asyncio.to_thread(responder_chat, request.prompt, history)
            respuesta = clean_llm_output(respuesta)
            await db.save_message(session_id, "assistant", respuesta)
            return {
                "chat_response": respuesta,
                "download_content": "",
                "download_filename": None,
            }

        if categoria == "consulta_puntual":
            resp = await responder_consulta_puntual(request.prompt, fecha_actual, history)
            chat_response = clean_llm_output(formatear_respuesta(resp))
            await db.save_message(session_id, "assistant", chat_response)
            return {
                "chat_response": chat_response,
                "download_content": "",
                "download_filename": None,
                # Mismos lugares/platos que ya están en chat_response, pero como
                # datos sueltos para que el frontend les ponga una imagen a cada uno.
                "items": [item.model_dump() for item in resp.items],
            }

        # categoria == "plan_completo" -> flujo original: Crew jerárquico completo.
        # Los Task/Agent de CrewAI no soportan chat multi-turno (solo un string
        # de "trip_request"), así que el historial se aplana como contexto.
        contexto = contexto_como_texto(history)
        trip_request = (
            f"Contexto de la conversación hasta ahora:\n{contexto}\n\n"
            f"Petición actual: {request.prompt}"
            if contexto
            else request.prompt
        )
        inputs = {
            'trip_request': trip_request,
            # Fecha de hoy: el agente de agenda la usa para resolver fechas relativas
            'fecha_actual': fecha_actual,
        }

        print(f"🚀 Ejecutando el crew para la petición: {request.prompt}")
        travel_crew = TravelCrew()
        # crewai 1.14+: dentro de un endpoint async hay que usar kickoff_async,
        # no kickoff (síncrono), o lanza "invoked synchronously from within a running event loop".
        result = await travel_crew.crew().kickoff_async(inputs=inputs)
        print(f"✅ Crew finalizado. Procesando resultado.")

        # 1. Obtener el resultado final y limpiarlo para el chat
        final_chat_response = clean_llm_output(result.raw)
        await db.save_message(session_id, "assistant", final_chat_response)

        # 2. Leer el contenido del archivo .md para la descarga
        download_content = ""
        filename = "itinerary.md"
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                download_content = f.read()
        except FileNotFoundError:
            print(f"⚠️  Advertencia: No se encontró el archivo '{filename}'. La descarga no estará disponible.")
            download_content = final_chat_response # Como fallback, usamos la respuesta del chat

        # 3. Construir la respuesta JSON estructurada
        structured_response = {
            "chat_response": final_chat_response,
            "download_content": download_content,
            "download_filename": filename
        }

        return structured_response

    except Exception as e:
        print(f"❌ Error durante la ejecución del crew: {e}")
        return JSONResponse(
            status_code=500,
            content={"message": "Ocurrió un error interno al procesar tu solicitud.", "details": str(e)}
        )

@app.get("/") #Segundo Endpoint.
def read_root():
    return {"status": "El servidor del Asistente de Viajes IA está funcionando."}
