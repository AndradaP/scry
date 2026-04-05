const ShardLogo = ({ size = 28, className = "" }: { size?: number; className?: string }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <polygon
        points="14,2 18,2.5 19,12 20,22 17,30 13,28 12,18 11,8"
        fill="#E8732A"
      />
      <polygon
        points="14,2 18,2.5 19,12 12,18 11,8"
        fill="#E8732A"
        opacity="0.7"
      />
    </svg>
  );
};

export default ShardLogo;
