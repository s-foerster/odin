import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { BASE } from "./lib/base";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Suspense, lazy } from "react";
import SessionGuard from "./components/session-guard";
import { LanguageProvider } from "./lib/LanguageContext";

// Lazy load page components with explicit chunkName
const NotFound = lazy(() => import(/* webpackChunkName: "notfound" */ "@/pages/not-found"));
const Home = lazy(() => import(/* webpackChunkName: "home" */ "@/pages/home"));
const Game = lazy(() => import(/* webpackChunkName: "game" */ "@/pages/game"));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
  </div>
);

// Create a wrapped route component to handle Suspense
const LazyRoute = ({ component: Component, ...rest }: any) => {
  return (
    <Route
      {...rest}
      component={(props: any) => (
        <Component {...props} />
      )}
    />
  );
};

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        <LazyRoute path="/" component={Home} />
        <LazyRoute path="/create" component={Home} />
        <LazyRoute path="/join" component={Home} />
        <LazyRoute path="/game/:gameId" component={Game} />
        <LazyRoute path="/lobby/:gameId" component={Game} />
        <LazyRoute component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <WouterRouter base={BASE}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <SessionGuard>
            <Router />
            <Toaster />
          </SessionGuard>
        </LanguageProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
