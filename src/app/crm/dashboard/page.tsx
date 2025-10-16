import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CrmDashboard() {
  return (
    <div className="flex h-screen bg-gray-100">
      <div className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>CRM Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Welcome to the Customer Relationship Management Dashboard.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}