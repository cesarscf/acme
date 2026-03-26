export default function SetupLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex min-h-svh items-center justify-center p-6">
			{children}
		</div>
	);
}
