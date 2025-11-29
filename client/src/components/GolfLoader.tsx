interface GolfLoaderProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

export function GolfLoader({ size = "md", text, className = "" }: GolfLoaderProps) {
  const sizes = {
    sm: "w-12 h-12",
    md: "w-20 h-20",
    lg: "w-32 h-32",
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} data-testid="golf-loader">
      <div className={`relative ${sizes[size]}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          <defs>
            <style>{`
              @keyframes driverSwing {
                0% { transform: rotate(-45deg); }
                35% { transform: rotate(-45deg); }
                50% { transform: rotate(85deg); }
                65% { transform: rotate(85deg); }
                100% { transform: rotate(-45deg); }
              }
              @keyframes ballFly {
                0%, 45% { opacity: 0; cx: 58; cy: 82; }
                50% { opacity: 1; cx: 58; cy: 82; }
                100% { opacity: 0; cx: 95; cy: 20; }
              }
              @keyframes ballTrail {
                0%, 45% { opacity: 0; }
                55% { opacity: 0.6; }
                80% { opacity: 0.3; }
                100% { opacity: 0; }
              }
              .golfer-swing {
                animation: driverSwing 1.4s ease-in-out infinite;
                transform-origin: 45px 45px;
              }
              .golf-ball {
                animation: ballFly 1.4s ease-out infinite;
              }
              .ball-trail {
                animation: ballTrail 1.4s ease-out infinite;
              }
            `}</style>
          </defs>
          
          {/* Golfer silhouette in driving stance */}
          <g fill="currentColor" className="text-primary">
            {/* Head with cap */}
            <ellipse cx="42" cy="18" rx="7" ry="8" />
            <path d="M35 14 L49 14 L47 11 L37 11 Z" />
            
            {/* Torso - bent forward for drive */}
            <path 
              d="M42 26 Q50 35 52 50" 
              strokeWidth="6" 
              stroke="currentColor" 
              fill="none" 
              strokeLinecap="round"
            />
            
            {/* Legs - wide stance */}
            <path 
              d="M52 50 L40 75 L38 90" 
              strokeWidth="5" 
              stroke="currentColor" 
              fill="none" 
              strokeLinecap="round"
            />
            <path 
              d="M52 50 L62 72 L68 88" 
              strokeWidth="5" 
              stroke="currentColor" 
              fill="none" 
              strokeLinecap="round"
            />
            
            {/* Feet */}
            <ellipse cx="36" cy="92" rx="6" ry="3" />
            <ellipse cx="70" cy="90" rx="6" ry="3" />
            
            {/* Arms and club - animated swing */}
            <g className="golfer-swing">
              {/* Back arm */}
              <path 
                d="M45 32 L38 45" 
                strokeWidth="4" 
                stroke="currentColor" 
                fill="none" 
                strokeLinecap="round"
              />
              {/* Front arm */}
              <path 
                d="M48 34 L55 48 L52 55" 
                strokeWidth="4" 
                stroke="currentColor" 
                fill="none" 
                strokeLinecap="round"
              />
              {/* Hands gripping */}
              <circle cx="52" cy="56" r="4" />
              
              {/* Driver club */}
              <path 
                d="M52 56 L58 82" 
                strokeWidth="2.5" 
                stroke="currentColor" 
                fill="none" 
                strokeLinecap="round"
              />
              {/* Driver head */}
              <ellipse 
                cx="60" 
                cy="86" 
                rx="6" 
                ry="4" 
                transform="rotate(15 60 86)"
              />
            </g>
          </g>
          
          {/* Golf ball flying */}
          <circle className="golf-ball text-muted-foreground" r="3" fill="currentColor" />
          
          {/* Ball trail effect */}
          <circle className="ball-trail text-muted-foreground/40" cx="70" cy="60" r="2" fill="currentColor" style={{ animationDelay: "0.1s" }} />
          <circle className="ball-trail text-muted-foreground/30" cx="80" cy="45" r="1.5" fill="currentColor" style={{ animationDelay: "0.15s" }} />
        </svg>
      </div>
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}
