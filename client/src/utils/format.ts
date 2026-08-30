export const formatDate = (value?: string | null) => {
  if (!value) return 'Not set'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ')
