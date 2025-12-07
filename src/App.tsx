import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AppSettingsProvider } from "./contexts/AppSettingsContext";
import { AccountProvider } from "./contexts/AccountContext";
import { JobProvider } from "./contexts/JobContext"; // Import JobProvider
import PageLayout from "@/components/layout/PageLayout";
import BulkImportPage from "./pages/BulkImportPage";
import SingleImportPage from "./pages/SingleImportPage";
import DashboardPage from "./pages/DashboardPage";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <Router>
      <AppSettingsProvider>
        <JobProvider> {/* <-- JobProvider must wrap AccountProvider */}
          <AccountProvider>
            <PageLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/import/bulk" element={<BulkImportPage />} />
                <Route path="/import/single" element={<SingleImportPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </PageLayout>
          </AccountProvider>
        </JobProvider>
        <Toaster position="top-right" richColors />
      </AppSettingsProvider>
    </Router>
  );
}

export default App;