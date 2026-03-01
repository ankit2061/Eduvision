import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import UserRolesOverview from "@/components/landing/UserRolesOverview";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import Footer from "@/components/landing/Footer";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";

const Index = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");
    if (error) {
      toast.error(`Login Error: ${errorDesc || error}`);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen">
      <HeroSection />
      <HowItWorks />
      <UserRolesOverview />
      <FeaturesGrid />
      <Footer />
    </div>
  );
};

export default Index;
