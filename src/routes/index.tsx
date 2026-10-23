import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  useEffect(() => { document.title = "Atalhos+ — Os teus atalhos"; }, []);
  return <iframe title="Atalhos+" src="/atalhos-plus.html" style={{ display: "block", width: "100%", height: "100vh", border: 0 }} />;
}
