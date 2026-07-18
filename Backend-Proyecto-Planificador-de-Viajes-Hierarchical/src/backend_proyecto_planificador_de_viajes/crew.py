# ============================================================================
# SISTEMA MULTI-AGENTE PARA PLANIFICACIÓN DE VIAJES  ·  MODO JERÁRQUICO
# ============================================================================
# Este archivo define el "Crew" (equipo) de agentes que trabajan juntos
# para crear itinerarios de viaje personalizados.
#
# DIFERENCIA CLAVE con el backend original (secuencial):
#   - Original  -> Process.sequential: las tareas se ejecutan en fila y cada
#                  una pasa su resultado a la siguiente (una TUBERÍA de datos).
#                  Los agentes NO dialogan, solo se pasan el output.
#   - Este       -> Process.hierarchical: un AGENTE MANAGER ("Jefe de Proyecto")
#                  coordina al equipo: decide a quién delegar, revisa lo que le
#                  entregan, pide correcciones y datos faltantes. Aquí SÍ hay
#                  diálogo/ida y vuelta entre el manager y los especialistas.
#
# Arquitectura: 1 agente manager + 6 agentes especializados + 6 tareas
# ============================================================================

import os
from dotenv import load_dotenv

# Importar componentes principales de CrewAI
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task  # Decoradores para organizar el código
# Herramienta de búsqueda en internet. Usamos Tavily (mejor para agentes de IA).
# La versión con DuckDuckGo sigue disponible en tools/custom_tool.py como alternativa:
#   from .tools.custom_tool import InternetSearchTool
from .tools.busqueda_internet_tool import TavilyInternetSearchTool
import agentops
agentops.init()

# DECORADOR @CrewBase: Indica que esta clase define un Crew
@CrewBase
class TravelCrew():
	"""TravelCrew para planificar viajes personalizados."""
	
	# Archivos YAML con las configuraciones de agentes y tareas
	# Esto separa la lógica del código de las definiciones de roles/objetivos
	agents_config = 'config/agents.yaml'
	tasks_config = 'config/tasks.yaml'

	# CONSTRUCTOR: Se ejecuta al crear una instancia del Crew
	def __init__(self) -> None:
		load_dotenv()  # Cargar variables de entorno (.env)

		# Inicializar la herramienta de búsqueda que usarán los agentes (Tavily)
		self.search_tool = TavilyInternetSearchTool()

	# ========================================================================
	# AGENTE MANAGER (coordinador del proceso jerárquico)
	# ========================================================================
	# OJO: este método NO lleva el decorador @agent a propósito.
	# El manager NO debe estar en la lista self.agents (los "trabajadores"),
	# porque CrewAI lo pasa por separado como manager_agent en el Crew.
	# Si lo pusiéramos en ambos lados, CrewAI lanzaría un error.
	# ========================================================================
	def agente_gestor_proyecto(self) -> Agent:
		"""Coordina al equipo: delega tareas, revisa entregas y pide correcciones."""
		return Agent(
			config=self.agents_config['agente_gestor_proyecto'],
			# allow_delegation=True: es lo que le permite HABLAR con los demás
			# agentes (hacerles preguntas y pedirles trabajo). Es el corazón del
			# "diálogo" entre agentes en el modo jerárquico.
			allow_delegation=True,
			verbose=True
			# NO tiene herramientas: no busca ni redacta, solo coordina.
		)

	# ========================================================================
	# DEFINICIÓN DE AGENTES
	# ========================================================================
	# Cada método con @agent define un "trabajador especializado"
	# El decorador @agent registra automáticamente el agente en self.agents
	# ========================================================================

	@agent
	def agente_experto_cultural(self) -> Agent:
		"""Busca atracciones turísticas, museos, sitios históricos."""
		return Agent(
			config=self.agents_config['agente_experto_cultural'],  # Lee role, goal, backstory del YAML
			tools=[self.search_tool],  # ¡PUEDE BUSCAR EN INTERNET!
			verbose=True  # Muestra el razonamiento del agente en consola
		)

	@agent
	def agente_gourmet_local(self) -> Agent:
		"""Busca restaurantes, comida típica, experiencias gastronómicas."""
		return Agent(
			config=self.agents_config['agente_gourmet_local'],
			tools=[self.search_tool],  # ¡PUEDE BUSCAR EN INTERNET!
			verbose=True
		)
	
	@agent
	def agente_logistica(self) -> Agent:
		"""Busca vuelos, hoteles, transporte y optimiza presupuesto."""
		return Agent(
			config=self.agents_config['agente_logistica'],
			tools=[self.search_tool],  # ¡PUEDE BUSCAR EN INTERNET!
			verbose=True
		)

	@agent
	def agente_planificador_itinerario(self) -> Agent:
		"""Organiza toda la información en un itinerario día por día."""
		return Agent(
			config=self.agents_config['agente_planificador_itinerario'],
			verbose=True
			# NO tiene herramientas: solo organiza la info de otros agentes
		)
	
	@agent
	def agente_agenda(self) -> Agent:
		"""Registra el itinerario en Google Calendar (un evento por día)."""
		return Agent(
			config=self.agents_config['agente_agenda'],
			# apps: tools de la Plataforma de CrewAI (Tools & Integrations).
			# CrewAI inyecta automáticamente la herramienta de crear eventos de
			# Google Calendar usando el token CREWAI_PLATFORM_INTEGRATION_TOKEN del .env.
			apps=['google_calendar/create_event'],
			verbose=True
		)

	@agent
	def agente_redactor_viajes(self) -> Agent:
		"""Escribe la versión final del itinerario en formato Markdown."""
		return Agent(
			config=self.agents_config['agente_redactor_viajes'],
			verbose=True
			# NO tiene herramientas: solo redacta el documento final
		)
	# ========================================================================


	# ========================================================================
	# DEFINICIÓN DE TAREAS
	# ========================================================================
	# Cada método con @task define un "trabajo específico" para un agente
	# El decorador @task registra automáticamente la tarea en self.tasks
	# ========================================================================

	@task
	def task_cultura(self) -> Task:
		"""Tarea: Investigar atracciones culturales del destino."""
		return Task(
			config=self.tasks_config['task_cultura'],  # Lee descripción y expected_output del YAML
		)

	@task
	def task_gastronomia(self) -> Task:
		"""Tarea: Investigar restaurantes y experiencias gastronómicas."""
		return Task(
			config=self.tasks_config['task_gastronomia'],
		)
	
	@task
	def task_logistica(self) -> Task:
		"""Tarea: Investigar vuelos, hoteles y transporte."""
		return Task(
			config=self.tasks_config['task_logistica'],
		)
	
	@task
	def task_itinerario(self) -> Task:
		"""Tarea: Crear itinerario completo día por día."""
		return Task(
			config=self.tasks_config['task_itinerario'],
			# CONTEXT: Esta tarea puede acceder a los resultados de las 3 tareas anteriores
			context=[self.task_cultura(), self.task_gastronomia(), self.task_logistica()]
		)
	
	@task
	def task_agenda(self) -> Task:
		"""Tarea: Crear un evento en Google Calendar por cada día del viaje."""
		return Task(
			config=self.tasks_config['task_agenda'],
			# CONTEXT: usa el itinerario día por día como fuente de los eventos
			context=[self.task_itinerario()],
		)

	@task
	def task_redaccion_final(self) -> Task:
		"""Tarea: Escribir el documento final en Markdown."""
		return Task(
			config=self.tasks_config['task_redaccion_final'],
			# CONTEXT: Usa el resultado del itinerario para redactar
			context=[self.task_itinerario()],
			# OUTPUT_FILE: Guarda automáticamente el resultado en un archivo
			output_file='itinerary.md'
		)
	# ========================================================================

	# ========================================================================
	# ENSAMBLAJE DEL CREW
	# ========================================================================
	# Este método ensambla todos los agentes y tareas en un equipo funcional
	# ========================================================================
	
	@crew
	def crew(self) -> Crew:
		"""Ensambla el equipo de agentes y define cómo trabajarán juntos."""

		return Crew(
			# self.agents: Lista automática de TRABAJADORES creada por los @agent.
			# IMPORTANTE: el manager NO está aquí (no lleva @agent); se pasa aparte.
			agents=self.agents,

			# self.tasks: Lista automática creada por los decoradores @task
			tasks=self.tasks,

			# PROCESS: Define cómo se ejecutan las tareas
			# - sequential: Una tras otra, en orden (task1 → task2 → task3...)
			# - hierarchical: Un manager coordina y delega (lo que usamos aquí)
			process=Process.hierarchical,

			# MANAGER_AGENT: el agente líder que coordina y delega el trabajo.
			# Es OBLIGATORIO en el proceso jerárquico (junto con manager_llm como
			# alternativa). CrewAI le entrega automáticamente las herramientas de
			# delegación para que pueda "hablar" con los agentes trabajadores.
			manager_agent=self.agente_gestor_proyecto(),

			# Alternativa más simple (sin agente personalizado): dejar que CrewAI
			# cree un manager genérico solo indicando el modelo. Descomenta y quita
			# manager_agent para probarlo:
			# manager_llm="gpt-5.1",

			# VERBOSE: Muestra logs detallados de lo que hacen los agentes
			verbose=True,

			# TRACING desactivado: evita el prompt interactivo "view your execution
			# traces? [y/N]" que bloquea la request 20s en un servidor (FastAPI).
			tracing=False,
		)
	
	# ========================================================================
	# FLUJO DE EJECUCIÓN (JERÁRQUICO):
	# ========================================================================
	# En lugar de una fila fija, el "Jefe de Proyecto" (manager) toma la petición
	# y va delegando cada tarea al especialista adecuado, revisando cada entrega:
	#
	#   MANAGER (agente_gestor_proyecto)
	#     ├─ delega task_cultura        → agente_experto_cultural (busca atracciones)
	#     ├─ delega task_gastronomia    → agente_gourmet_local (busca restaurantes)
	#     ├─ delega task_logistica      → agente_logistica (vuelos/hoteles)
	#     ├─ delega task_itinerario     → agente_planificador_itinerario (arma el plan)
	#     ├─ delega task_agenda         → agente_agenda (Google Calendar)
	#     └─ delega task_redaccion_final→ agente_redactor_viajes (documento final)
	#
	# Si una entrega está incompleta o incoherente, el manager PUEDE devolverla
	# al especialista y pedirle que la corrija: ahí está el diálogo entre agentes.
	# ========================================================================
