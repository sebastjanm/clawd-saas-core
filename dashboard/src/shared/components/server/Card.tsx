interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`glass-static rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
}
