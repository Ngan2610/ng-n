/** Một ô nhập có nhãn và thông báo lỗi. */
export default function Field({ id, label, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <p className="err" role="alert">{error}</p> : null}
    </div>
  );
}
