import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useEffect } from "react";
import LandingPage from "./pages/LandingPage";
import Home from "./pages/home";
import SimpleUpload from "./pages/SimpleUpload";
import DocResultPage from "./pages/DocResult";
import Success from "./pages/Success";
import BillingSuccess from "./pages/BillingSuccess";
import BillingCancel from "./pages/BillingCancel";
import Account from "./pages/Account";
import Auth from "./pages/Auth";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { handleUpgrade } from "./lib/handleUpgrade";
import "./index.css";

const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/auth", element: <Auth /> },
  { path: "/upload", element: <SimpleUpload /> },
  { path: "/upload-old", element: <Home /> },
  { path: "/doc/:id", element: <DocResultPage /> },
  { path: "/success", element: <Success /> },
  { path: "/billing/success", element: <BillingSuccess /> },
  { path: "/billing/cancel", element: <BillingCancel /> },
  { path: "/account", element: <Account /> },
]);

function Root() {
  useEffect(() => {
    const pendingUpgrade = sessionStorage.getItem('pendingUpgrade');
    if (pendingUpgrade) {
      sessionStorage.removeItem('pendingUpgrade');
      console.log('Resuming pending upgrade:', pendingUpgrade);
      handleUpgrade(pendingUpgrade as 'standard' | 'pro' | 'family');
    }
  }, []);

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
