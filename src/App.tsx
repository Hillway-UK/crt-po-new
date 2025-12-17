import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PurchaseOrders from "./pages/PurchaseOrders";
import CreatePO from "./pages/CreatePO";
import PODetail from "./pages/PODetail";
import EditPO from "./pages/EditPO";
import Approvals from "./pages/Approvals";
import Contractors from "./pages/Contractors";
import Properties from "./pages/Properties";
import Invoices from "./pages/Invoices";
import InvoiceDetail from "./pages/InvoiceDetail";
import UserManagement from "./pages/UserManagement";
import Settings from "./pages/Settings";
import WorkflowSettings from "./pages/WorkflowSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pos" element={<PurchaseOrders />} />
            <Route path="/pos/new" element={<CreatePO />} />
            <Route path="/pos/:id" element={<PODetail />} />
            <Route path="/pos/:id/edit" element={<EditPO />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/contractors" element={<Contractors />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoice/:id" element={<InvoiceDetail />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/workflows" element={<WorkflowSettings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
