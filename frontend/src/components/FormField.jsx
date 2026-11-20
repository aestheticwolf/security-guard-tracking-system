export default function FormField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  as = "input",
  rows = 4,
  options = []
}) {
  return (
    <label className="block">
      <span className="app-label">{label}</span>
      {as === "textarea" ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="app-input"
        />
      ) : as === "select" ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="app-input"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="app-input"
        />
      )}
    </label>
  );
}
