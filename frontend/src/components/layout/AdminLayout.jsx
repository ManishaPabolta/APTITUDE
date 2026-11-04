export default function AdminLayout({ sidebar, header, children }) {
  return <div className="min-h-screen bg-canvas">
    {sidebar}
    <div className="min-h-screen lg:pl-[260px]">
      {header}
      <main className="mx-auto w-full max-w-[1500px] overflow-x-hidden p-3 sm:p-5 lg:p-8">{children}</main>
    </div>
  </div>;
}
