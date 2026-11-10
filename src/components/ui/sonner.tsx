import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        duration: 2000,
        classNames: {
          toast:
            "group toast group-[.toaster]:!border group-[.toaster]:!border-white/20 group-[.toaster]:!bg-gradient-to-r group-[.toaster]:!from-slate-950/95 group-[.toaster]:!via-indigo-950/95 group-[.toaster]:!to-violet-950/95 group-[.toaster]:!text-white group-[.toaster]:!shadow-[0_12px_38px_rgba(0,0,0,.5)] group-[.toaster]:!backdrop-blur-2xl group-[.toaster]:!rounded-2xl group-[.toaster]:!px-4 group-[.toaster]:!py-3",
          title: "group-[.toast]:!text-white group-[.toast]:!font-bold",
          description: "group-[.toast]:!text-white/80",
          success: "group-[.toast]:!border-emerald-300/50",
          error: "group-[.toast]:!border-rose-300/60",
          warning: "group-[.toast]:!border-amber-300/60",
          info: "group-[.toast]:!border-sky-300/60",
          actionButton: "group-[.toast]:!bg-white/15 group-[.toast]:!text-white",
          cancelButton: "group-[.toast]:!bg-white/10 group-[.toast]:!text-white/80",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
