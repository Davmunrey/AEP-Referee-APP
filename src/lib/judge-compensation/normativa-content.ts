import {
  competitionManagerRate,
  COMPENSATION_RATES_REVISION,
  KM_RATE_EUR,
  LODGING_MIN_ROUND_TRIP_KM,
  LODGING_PER_DAY_EUR,
  MIN_FUNCTIONS_FOR_LODGING,
  unitRateForDuty,
} from "./rates";

export const COMPENSATION_NORMATIVA_META = {
  title: "Compensación de gastos de jueces",
  revision: COMPENSATION_RATES_REVISION,
  revisionLabel: "31 de octubre de 2025",
  sourcePdf:
    "https://powerliftingspain.es/wp-content/uploads/2025/10/20251031_Criterios-Compensacion-Gastos-Jueces.pdf",
} as const;

// Las cifras salen del mismo baremo que hace las cuentas (`rates.ts`) en vez
// de escribirse a mano: la tabla que se le enseña al juez no puede decir una
// cosa y la liquidación pagar otra cuando el baremo se actualice.
const eur = (amount: number) => `${amount} €`;

export const COMPENSATION_RATE_TABLE = [
  {
    concept: "Pesaje",
    aep3: eur(unitRateForDuty("pesaje", "AEP-3", "nacional")),
    aep2: eur(unitRateForDuty("pesaje", "AEP-2", "nacional")),
    aep1: eur(unitRateForDuty("pesaje", "AEP-1", "nacional")),
    intl: eur(unitRateForDuty("pesaje", "AEP-1", "ipf")),
  },
  {
    concept: "Sesión (tarima)",
    aep3: eur(unitRateForDuty("session", "AEP-3", "nacional")),
    aep2: eur(unitRateForDuty("session", "AEP-2", "nacional")),
    aep1: eur(unitRateForDuty("session", "AEP-1", "nacional")),
    intl: eur(unitRateForDuty("session", "AEP-1", "ipf")),
  },
  { concept: "Montaje sistema", aep3: "Manual", aep2: "Manual", aep1: "Manual", intl: "Manual" },
  { concept: "Km ida+vuelta", aep3: `${KM_RATE_EUR} €/km`, aep2: "—", aep1: "—", intl: "—" },
  { concept: "Alojamiento / día", aep3: `${LODGING_PER_DAY_EUR} €`, aep2: "—", aep1: "—", intl: "—" },
  {
    concept: "Responsable competición",
    aep3: eur(competitionManagerRate("AEP-3", "nacional", false, 1)),
    aep2: eur(competitionManagerRate("AEP-2", "nacional", false, 1)),
    // El asterisco remite a la nota: en AEP-1 puede ser por día o dos responsables.
    aep1: `${eur(competitionManagerRate("AEP-1", "nacional", false, 1))}*`,
    intl: eur(competitionManagerRate("AEP-1", "ipf", false, 1)),
  },
] as const;

export const COMPENSATION_NORMATIVA_SECTIONS = [
  {
    id: "responsable",
    title: "Quién gestiona la compensación",
    body: "La compensación económica la gestiona el rol responsable financiero de jueces (y el super_admin como respaldo). No la gestiona el delegado de zona ni el delegado de jueces.",
  },
  {
    id: "funciones",
    title: "Funciones en tarima",
    body: "Se paga una línea por sesión y posición (S1 Central, S1 Ordenador, S1 Pesaje, etc.). Ocupar la posición ordenador o liftingcast durante el campeonato se paga como cualquier otra función de tarima.",
  },
  {
    id: "montaje",
    title: "Montaje del sistema informático",
    body: "Caso aparte del puesto de ordenador en sesión. Corresponde a montar o configurar Liftingcast, OpenLifter o Goodlift. Se marca en compensación con Mont. e importe manual.",
  },
  {
    id: "km",
    title: "Kilometraje",
    body: `Los km ida+vuelta se introducen manualmente por juez (enteros). Tarifa: ${KM_RATE_EUR} €/km. Solo se paga desplazamiento si el juez viaja exclusivamente como juez. En vehículo compartido, un solo cobro de km en el conductor.`,
  },
  {
    id: "comparte",
    title: "Comparte vehículo",
    body: "Solo exime el cobro de kilometraje al pasajero. Los km siguen siendo obligatorios porque se usan para calcular alojamiento.",
  },
  {
    id: "alojamiento",
    title: "Alojamiento",
    body: `Aplica con ida+vuelta superior a ${LODGING_MIN_ROUND_TRIP_KM} km y al menos ${MIN_FUNCTIONS_FOR_LODGING} funciones. ${LODGING_PER_DAY_EUR} € por día de campeonato. Aplica aunque el juez comparta vehículo.`,
  },
  {
    id: "internacional",
    title: "Campeonatos EPF / IPF",
    body: "El hotel oficial queda fuera de este cálculo. El responsable de competición no se paga en ámbito internacional (ambito epf o ipf en el campeonato).",
  },
  {
    id: "recibo",
    title: "Recibo PDF e IBAN",
    body: "El recibo sigue la plantilla AEP o club según el organizador del campeonato. El IBAN solo se pide al exportar el PDF y no se almacena en la aplicación.",
  },
] as const;

export const COMPENSATION_NORMATIVA_FOOTNOTES = [
  "AEP-1 responsable: puede ser 20 €/día o dos responsables — decisión del Presidente del Comité.",
  "Montaje sistema: importe manual según acuerdo con el organizador.",
] as const;
