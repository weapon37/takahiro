import type { Metadata } from "next";
import CourseSimulator from "@/components/marathon/CourseSimulator";

export const metadata: Metadata = {
  title: "マラソンコース シミュレーター",
  description:
    "GPXからマラソンコースを読み込み、ストリートビューで順番に予習できる試作ツールです。",
};

export default function MarathonPage() {
  return (
    <main className="flex flex-1 justify-center">
      <CourseSimulator />
    </main>
  );
}
