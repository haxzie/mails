import { SettingsNav } from "@/components/settings-nav";
import { TopBar } from "@/components/shell";

export default async function SettingsLayout({
  children,
  params,
}: LayoutProps<"/p/[slug]/settings">) {
  const { slug } = await params;

  return (
    <>
      <TopBar
        title="Settings"
        description="Sending identity, Amazon SES credentials and deliverability"
      />
      {/* Full height so the nav column's divider reaches the bottom of the
          panel: 3rem of top bar plus the panel's 1rem of outer margin. */}
      <div className="flex min-h-[calc(100dvh-4rem)] items-stretch">
        <SettingsNav slug={slug} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
