"use client"

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Coins, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreditsDisplayProps {
  initialCredits?: number;
  showRefresh?: boolean;
}

export function CreditsDisplay({ initialCredits = 0, showRefresh = false }: CreditsDisplayProps) {
  const [credits, setCredits] = useState(initialCredits);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCredits = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/credits');
      if (response.ok) {
        const data = await response.json();
        setCredits(data.credits);
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialCredits === 0) {
      fetchCredits();
    }
  }, [initialCredits]);

  const getCreditsColor = () => {
    if (credits === 0) return "destructive";
    if (credits <= 5) return "secondary";
    return "default";
  };

  return (
    <div className="flex items-center space-x-2">
      <Badge variant={getCreditsColor()} className="flex items-center space-x-1">
        <Coins className="h-3 w-3" />
        <span>{credits} credits</span>
      </Badge>
      {showRefresh && (
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchCredits}
          disabled={isLoading}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  );
}
