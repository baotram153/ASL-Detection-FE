
// Navigation item component
export function NavItem({ icon, label, active, danger = false }: { icon: React.ReactNode, label: string, active?: boolean, danger?: boolean }) {
    return (
        <div
        className={`flex items-center w-full px-6 py-2 ${active ? "bg-[#3F2D5A]" : ""} ${danger ? "text-red-400" : "text-gray-300"}`}
        >
        <div className="flex items-center space-x-3">
            <div>{icon}</div>
            <div className="text-sm font-medium">{label}</div>
        </div>
        {active && (
            <div className="ml-auto">
            <div className="h-full w-1 bg-[#FF6B4A] rounded-full"></div>
            </div>
        )}
        </div>
    )
}