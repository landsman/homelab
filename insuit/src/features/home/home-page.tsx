import { m } from "@/paraglide/messages.js";

export function HomePage() {
  return (
    <main className="wrapper home">
      <h1>{m.home_heading()}</h1>

      <div className="content">
        <p>{m.home_intro()}</p>
        <p>{m.home_work()}</p>
        <p>{m.home_craft()}</p>
      </div>
    </main>
  );
}
