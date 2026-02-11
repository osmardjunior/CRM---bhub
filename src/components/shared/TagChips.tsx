import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface TagChipsProps {
  tags: string[];
  onRemove?: (tag: string) => void;
  size?: 'sm' | 'default';
}

export default function TagChips({ tags, onRemove, size = 'default' }: TagChipsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className={`font-normal ${
            size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs'
          } ${onRemove ? 'gap-0.5 cursor-pointer hover:bg-destructive/15 hover:text-destructive transition-colors' : ''}`}
          onClick={onRemove ? () => onRemove(tag) : undefined}
        >
          {tag}
          {onRemove && <X size={10} className="shrink-0" />}
        </Badge>
      ))}
    </div>
  );
}
