/** The same template artwork used by the native PalancaMark asset. */
export default function AppMark({ size = 32 }: { size?: number }) {
  return <span aria-hidden="true" className="app-mark" style={{ width: size, height: size }} />;
}
