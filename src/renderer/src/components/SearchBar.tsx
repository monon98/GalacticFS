/**
 * 搜索输入框：输入关键词实时过滤并高亮场景中匹配的星球（文档 §2.2 搜索高亮）。
 * 匹配规则：名称包含关键词（大小写不敏感）；空关键词不匹配任何星球。
 */

export function SearchBar({
  value,
  onChange
}: {
  value: string
  onChange: (query: string) => void
}): React.JSX.Element {
  return (
    <input
      type="search"
      className="search-input"
      placeholder="搜索文件 / 文件夹…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
