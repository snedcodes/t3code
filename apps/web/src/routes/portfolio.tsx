import { createFileRoute } from "@tanstack/react-router";
import { PortfolioPage } from "../components/PortfolioPage";

export const Route = createFileRoute("/portfolio")({ component: PortfolioPage });
