import Image from "next/image";

export default function DeviceFrame({ src, alt, hero = false }: { src: string; alt: string; hero?: boolean }) {
  return (
    <div className="device-frame">
      <span className="device-button device-button-action" aria-hidden="true" />
      <span className="device-button device-button-volume" aria-hidden="true" />
      <span className="device-button device-button-power" aria-hidden="true" />
      <div className="device-screen">
        <Image src={src} alt={alt} width={1320} height={2868} sizes={hero ? "(max-width: 760px) 280px, 320px" : "(max-width: 760px) 300px, (max-width: 1050px) 28vw, 340px"} preload={hero} />
      </div>
    </div>
  );
}
