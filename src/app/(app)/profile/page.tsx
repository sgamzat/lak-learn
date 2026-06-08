import { redirect } from "next/navigation";

// Профиль пока совмещён с настройками.
// Когда появится отдельная страница — убрать redirect.
export default function ProfilePage() {
  redirect("/settings");
}