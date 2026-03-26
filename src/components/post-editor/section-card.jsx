import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SectionCard({ title, description, icon: Icon, open, onToggle, children }) {
  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-cyan-200" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm">
            {open ? "Ocultar" : "Mostrar"}
          </Button>
        </div>
      </CardHeader>
      {open ? <CardContent className="space-y-4">{children}</CardContent> : null}
    </Card>
  );
}
