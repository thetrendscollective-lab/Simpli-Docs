import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Home from "./pages/home";
import SimpleUpload from "./pages/SimpleUpload";
import DocResultPage from "./pages/DocResult";
import Success from "./pages/Success";
import BillingSuccess from "./pages/BillingSuccess";
import BillingCancel from "./pages/BillingCancel";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./index.css";

const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/upload", element: <SimpleUpload /> },
  { path: "/upload-old", element: <Home /> },
  { path: "/doc/:id", element: <DocResultPage /> },
  { path: "/success", element: <Success /> },
  { path: "/billing/success", element: <BillingSuccess /> },
  { path: "/billing/cancel", element: <BillingCancel /> },
]);

function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
