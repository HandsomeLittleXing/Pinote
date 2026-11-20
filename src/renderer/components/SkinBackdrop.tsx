import React from 'react';
import { useTheme } from '../hooks/useTheme';
import { STICKER_DOODLES, type StickerDoodleName } from '../../shared/stickerDoodles';

const stickerDrawingNames: StickerDoodleName[] = ['cup', 'buddy', 'flower', 'star', 'leaf', 'cat'];

/** 列表/设置窗口的皮肤氛围层：纯装饰，不拦截点击 */
export function SkinBackdrop() {
  const { skin } = useTheme();

  return (
    <div className="skin-backdrop" aria-hidden="true" data-backdrop-skin={skin}>
      {skin === 'glass' ? (
        <div className="sticker-doodle-field">
          {stickerDrawingNames.map((name) => (
            <svg key={name} className={`sticker-doodle sticker-doodle--${name}`}
              viewBox={STICKER_DOODLES[name].viewBox} fill="none"
              stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              {STICKER_DOODLES[name].paths.map((path, index) => <path key={index} d={path} />)}
            </svg>
          ))}
        </div>
      ) : null}
      {skin === 'vellum' ? (
        <>
          <span className="vellum-sheet vellum-sheet--a" />
          <span className="vellum-sheet vellum-sheet--b" />
          <span className="sky-grain" />
        </>
      ) : null}
      {skin === 'mote' ? (
        <>
          <span className="skin-blob skin-blob--a" />
          <span className="skin-blob skin-blob--b" />
          <span className="mote-spark mote-spark--a" />
          <span className="mote-spark mote-spark--b" />
        </>
      ) : null}
    </div>
  );
}
