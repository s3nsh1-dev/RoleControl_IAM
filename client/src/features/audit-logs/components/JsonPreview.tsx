type JsonPreviewProps = {
  value: Record<string, unknown> | null
}

export function JsonPreview({ value }: JsonPreviewProps) {
  return (
    <pre className="json-preview">
      {value ? JSON.stringify(value, null, 2) : 'null'}
    </pre>
  )
}
