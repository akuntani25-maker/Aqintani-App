import React from 'react';
import { Skeleton } from './ui/skeleton';

const Header = () => (
  <div className="flex items-end justify-between gap-4">
    <div className="space-y-2.5">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-4 w-64" />
    </div>
    <Skeleton className="h-9 w-36 rounded-full" />
  </div>
);

const Stats = ({ count = 4 }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }, (_, i) => (
      <div key={`stat-${i}`} className="rounded-tw bg-card border border-border/50 shadow-soft p-5 flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
    ))}
  </div>
);

const TableBlock = ({ rows = 7 }) => (
  <div className="rounded-tw bg-card border border-border/50 shadow-soft p-5 space-y-4">
    <div className="flex gap-3">
      <Skeleton className="h-9 flex-1 rounded-lg" />
      <Skeleton className="h-9 w-36 rounded-lg hidden md:block" />
      <Skeleton className="h-9 w-36 rounded-lg hidden md:block" />
    </div>
    <Skeleton className="h-10 w-full rounded-lg" />
    {Array.from({ length: rows }, (_, i) => (
      <div key={`row-${i}`} className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        <Skeleton className="h-4 flex-[2]" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 flex-1 hidden md:block" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
    ))}
  </div>
);

const Chart = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <div className="lg:col-span-2 rounded-tw bg-card border border-border/50 shadow-soft p-5 space-y-4">
      <Skeleton className="h-5 w-44" />
      <div className="flex items-end gap-3 h-52">
        {[45, 70, 35, 85, 55, 95, 60].map((h, i) => (
          <Skeleton key={`bar-${i}`} className="flex-1 rounded-t-lg rounded-b-none" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
    <div className="rounded-tw bg-card border border-border/50 shadow-soft p-5 space-y-4 flex flex-col items-center">
      <Skeleton className="h-5 w-40 self-start" />
      <Skeleton className="h-44 w-44 rounded-full" />
    </div>
  </div>
);

const Form = () => (
  <div className="rounded-tw bg-card border border-border/50 shadow-soft p-6 space-y-5 max-w-3xl">
    {Array.from({ length: 5 }, (_, i) => (
      <div key={`field-${i}`} className="space-y-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    ))}
    <Skeleton className="h-9 w-32 rounded-full" />
  </div>
);

const Receipt = () => (
  <div className="min-h-screen bg-background p-4 flex justify-center">
    <div className="w-full max-w-sm space-y-4 pt-4">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 flex-1 rounded-full" />
      </div>
      <div className="rounded-xl bg-card shadow-soft p-6 space-y-3">
        <Skeleton className="h-5 w-40 mx-auto" />
        <Skeleton className="h-3 w-52 mx-auto" />
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={`line-${i}`} className="h-3.5 w-full" />)}
        <Skeleton className="h-5 w-32 ml-auto" />
      </div>
    </div>
  </div>
);

export const PageSkeleton = ({ variant = 'table' }) => {
  if (variant === 'receipt') return <Receipt />;
  return (
    <div className="p-4 md:p-6 lg:p-8 flex flex-col gap-6" data-testid="page-skeleton" aria-busy="true">
      <Header />
      {variant === 'dashboard' && <><Stats /><Stats /><Chart /></>}
      {variant === 'table' && <><Stats count={4} /><TableBlock /></>}
      {variant === 'list' && <TableBlock rows={9} />}
      {variant === 'form' && <Form />}
    </div>
  );
};
