import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  Package,
  LandPlot,
  Sprout,
  DollarSign,
  AreaChart,
  Mail,
} from "lucide-react";
import AccountDropdown from "../AccountDropdown";

const navItems = [
  { to: "/", icon: LayoutGrid, label: "Dashboard" },
  { to: "/parcelles", icon: LandPlot, label: "Parcelles" },
  { to: "/cultures", icon: Sprout, label: "Cultures" },
  { to: "/finances", icon: DollarSign, label: "Finances" },
  { to: "/inventaire", icon: Package, label: "Inventaire" },
  { to: "/statistiques", icon: AreaChart, label: "Statistiques" },
  { to: "/subscribers", icon: Mail, label: "Subscribers" },
];

export const Sidebar = () => {
  return (
    <div className="hidden w-64 flex-col border-r bg-gray-100/40 p-4 dark:bg-gray-800/40 lg:flex">
      <nav className="flex flex-col gap-2">
        {/* Renders all the page links */}
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50 ${
                isActive ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-50" : ""
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}

        {/* Separator line */}
        <hr className="my-3 border-gray-200 dark:border-gray-700" />

        {/* Account Dropdown */}
        <AccountDropdown />
      </nav>
    </div>
  );
};