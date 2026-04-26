import type React from 'react';

type MaxWidth = React.CSSProperties['maxWidth'];

export function lineClamp(lines: number, maxWidth?: MaxWidth): React.CSSProperties {
    return {
        ...(maxWidth === undefined ? {} : { maxWidth }),
        display: '-webkit-box',
        WebkitLineClamp: lines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        overflowWrap: 'anywhere',
    };
}

export function singleLineEllipsis(maxWidth?: MaxWidth): React.CSSProperties {
    return {
        ...(maxWidth === undefined ? {} : { maxWidth }),
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
    };
}

export const clampText = lineClamp;
export const singleLineClamp = singleLineEllipsis;
