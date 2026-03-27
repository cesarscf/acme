"use client";

import { FileText, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
	{ href: "/pages", label: "Páginas", icon: FileText },
	{ href: "/settings", label: "Configurações", icon: Settings },
];

export function SidebarNav() {
	const pathname = usePathname();

	return (
		<nav className="flex flex-col gap-1 px-4">
			{items.map((item) => {
				const isActive = pathname.startsWith(item.href);

				return (
					<Link
						key={item.href}
						href={item.href}
						className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
							isActive
								? "bg-muted text-foreground font-medium"
								: "text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
					>
						<item.icon className="size-4" />
						{item.label}
					</Link>
				);
			})}
		</nav>
	);
}
