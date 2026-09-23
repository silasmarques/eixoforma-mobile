/** 0=domingo..6=sábado — mesma convenção usada em workout_day_weekdays. */
export const WEEKDAY_SHORT_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const WEEKDAY_ABBR_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function currentWeekday(referenceDate: Date = new Date()): number {
  return referenceDate.getDay();
}
