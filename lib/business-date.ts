export function getLocalDateStr(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(date: string, days: number) {
  const local = new Date(date + 'T00:00:00')
  local.setDate(local.getDate() + days)
  return getLocalDateStr(local)
}

// 深夜0時〜朝4時59分は前日を営業日として扱う。
export function getBusinessDateStr() {
  return getLocalDateStr(new Date(Date.now() - 5 * 60 * 60 * 1000))
}
