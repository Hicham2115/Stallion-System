import logo from '@/assets/png.png';

/** Same logo markup as the agency admin sidebar — for portal / other apps only. */
export default function SidebarBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <img src={logo} alt="Stallion Logo" width={180} height={180} />
    </div>
  );
}
