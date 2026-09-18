export function FormLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="label">
      {children}
      {required && (
        <span className="text-red-500" aria-hidden>
          {" "}*
        </span>
      )}
    </label>
  );
}
