import { getImageProps } from "next/image";

/** An iPhone showing the app screenshot that matches the visitor's light or dark appearance. */
export default function DeviceFrame({ src, lightSrc, alt, hero = false }: { src: string; lightSrc?: string; alt: string; hero?: boolean }) {
  const common = {
    alt,
    width: 1320,
    height: 2868,
    sizes: hero ? "(max-width: 760px) 280px, 320px" : "(max-width: 760px) 300px, (max-width: 1050px) 28vw, 340px",
    fetchPriority: hero ? ("high" as const) : undefined,
    loading: hero ? ("eager" as const) : undefined,
  };
  const { props: { srcSet: dark, ...image } } = getImageProps({ ...common, src });
  const light = lightSrc ? getImageProps({ ...common, src: lightSrc }).props.srcSet : undefined;
  return (
    <div className="device-frame">
      <span className="device-button device-button-action" aria-hidden="true" />
      <span className="device-button device-button-volume" aria-hidden="true" />
      <span className="device-button device-button-power" aria-hidden="true" />
      <div className="device-screen">
        <picture>
          {light && <source media="(prefers-color-scheme: light)" srcSet={light} />}
          {/* eslint-disable-next-line @next/next/no-img-element -- getImageProps supplies the optimised sources */}
          <img {...image} srcSet={dark} alt={alt} />
        </picture>
      </div>
    </div>
  );
}
