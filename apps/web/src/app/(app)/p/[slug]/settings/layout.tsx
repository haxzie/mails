import { SettingsNav } from "@/components/settings-nav";
import { TopBar } from "@/components/shell";

export const instant = false;

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
      <div className="flex items-start">
        <SettingsNav slug={slug} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
