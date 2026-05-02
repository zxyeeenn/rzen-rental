import { DashboardRooms } from "@/components/dashboard/dashboard-rooms";
import { fetchOwnerRooms } from "@/lib/db/queries";
import { isSupabasePublicConfigured } from "@/lib/env";
import { getServerAuth } from "@/lib/supabase/server";

export default async function DashboardPage() {
  let user: unknown = null;
  if (isSupabasePublicConfigured()) {
    const { user: u } = await getServerAuth();
    user = u;
  }

  const rooms = await fetchOwnerRooms();
  const canPersist = Boolean(user);

  return (
    <div>
      <DashboardRooms rooms={rooms} canPersist={canPersist} />
    </div>
  );
}
