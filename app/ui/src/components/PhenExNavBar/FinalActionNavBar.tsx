import React, { useState, useRef, useEffect } from 'react';
import styles from './NavBar.module.css';
import localStyles from './FinalActionNavBar.module.css';
import { PhenExNavBarMenu } from './PhenExNavBarMenu';
import { PhenExNavBarTooltip } from './PhenExNavBarTooltip';
import { SwitchButton } from '../ButtonsAndTabs/SwitchButton/SwitchButton';
import { LevelSelect } from '../ButtonsAndTabs/LevelSelect/LevelSelect';
import { CohortDataService } from '../../views/CohortViewer/CohortDataService/CohortDataService';
import { useNavBarMenu } from './PhenExNavBarMenuContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MenuItem {
  type: string;
  label: string;
  divider?: boolean;
  onClick?: () => void;
}

export interface FinalActionNavBarProps {
  height: number;

  // ── ViewNavBar props ──────────────────────────────────────────────────────
  scrollPercentage?: number;
  canScrollLeft?: boolean;
  canScrollRight?: boolean;
  onViewNavigationArrowClicked?: (direction: 'left' | 'right') => void;
  onViewNavigationScroll?: (percentage: number) => void;
  onViewNavigationVisibilityClicked?: () => void;
  scrollbarTooltipLabel?: string;
  leftArrowTooltipLabel?: string;
  rightArrowTooltipLabel?: string;
  flipScrollDirection?: boolean;
  onFlipScrollDirectionChange?: (value: boolean) => void;

  // ── CallToAction props ────────────────────────────────────────────────────
  showReport?: boolean;
  onShowReportChange?: (value: boolean) => void;
  onSectionTabChange?: (index: number) => void;
  dragHandleRef?: React.RefObject<HTMLDivElement>;
  shadow?: boolean;
  menuItems?: MenuItem[];
  mode?: 'cohortviewer' | 'studyviewer';
  onAddButtonClick?: () => void;
}

// ─── Visibility Menu (eye button) ─────────────────────────────────────────────

const VisibilityMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  anchorElement: HTMLElement | null;
  menuRef: React.RefObject<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  flipScrollDirection: boolean;
  onFlipScrollDirectionChange: (value: boolean) => void;
}> = ({
  isOpen,
  onClose,
  anchorElement,
  menuRef,
  onMouseEnter,
  onMouseLeave,
  flipScrollDirection,
  onFlipScrollDirectionChange,
}) => {
  const dataService = CohortDataService.getInstance();
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [showChildren, setShowChildren] = useState(() => dataService.getShowComponents());
  const [componentLevel, setComponentLevel] = useState(() => dataService.getComponentLevel());
  const [levelOverridesActive, setLevelOverridesActive] = useState(() => dataService.hasLevelOverrides());
  const [showFullCodelists, setShowFullCodelists] = useState(() => dataService.getShowFullCodelists());

  useEffect(() => {
    const sync = () => {
      setComponentLevel(dataService.getComponentLevel());
      setLevelOverridesActive(dataService.hasLevelOverrides());
      setShowChildren(dataService.getShowComponents());
    };
    dataService.addListener(sync);
    return () => dataService.removeListener(sync);
  }, [dataService]);

  const handleShowChildrenChange = (value: boolean) => {
    setShowChildren(value);
    dataService.toggleComponentPhenotypes(value);
  };

  const handleComponentLevelChange = (value: number) => {
    setComponentLevel(value);
    setLevelOverridesActive(false);
    dataService.setComponentLevel(value);
  };

  const handleShowFullCodelistsChange = (value: boolean) => {
    setShowFullCodelists(value);
    dataService.toggleShowFullCodelists(value);
  };

  return (
    <PhenExNavBarMenu
      isOpen={isOpen}
      onClose={onClose}
      anchorElement={anchorElement}
      menuRef={menuRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      verticalPosition="above"
      horizontalAlignment="center"
    >
      <div className={localStyles.visibilityMenuContent}>
        <div className={localStyles.visibilityMenuTitle}>Visibility Options</div>
        <SwitchButton label="Show Descriptions" value={showDescriptions} onValueChange={setShowDescriptions} />
        <div className={localStyles.visibilityMenuRow}>
          <SwitchButton label="Show Children" value={showChildren} onValueChange={handleShowChildrenChange} />
          <LevelSelect
            value={componentLevel}
            onChange={handleComponentLevelChange}
            maxLevel={dataService.getMaxComponentLevel()}
            disabled={!showChildren}
            mixed={levelOverridesActive}
            title="Show components up to this depth"
          />
        </div>
        <SwitchButton label="Show Full Codelists" value={showFullCodelists} onValueChange={handleShowFullCodelistsChange} />
        <SwitchButton label="Flip Scroll Direction" value={flipScrollDirection} onValueChange={onFlipScrollDirectionChange} />
      </div>
    </PhenExNavBarMenu>
  );
};

// ─── Add Menu (+ button, cohort viewer) ───────────────────────────────────────

const ALL_PHENOTYPE_TYPES = [
  { type: 'inclusion', label: 'Inclusion' },
  { type: 'exclusion', label: 'Exclusion' },
  { type: 'baseline', label: 'Characteristic' },
  { type: 'outcome', label: 'Outcome' },
] as const;

const PHENOTYPE_TYPES_BY_SECTION: Record<string, readonly string[]> = {
  Definition: ['inclusion', 'exclusion'],
  Characteristics: ['baseline'],
  Outcomes: ['outcome'],
  All: ['inclusion', 'exclusion', 'baseline', 'outcome'],
};

const AddMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  anchorElement: HTMLElement | null;
  menuRef: React.RefObject<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  activeSection: string;
}> = ({ isOpen, onClose, anchorElement, menuRef, onMouseEnter, onMouseLeave, activeSection }) => {
  const dataService = CohortDataService.getInstance();
  const allowedTypes = PHENOTYPE_TYPES_BY_SECTION[activeSection] ?? PHENOTYPE_TYPES_BY_SECTION.All;
  const phenotypeTypes = ALL_PHENOTYPE_TYPES.filter(({ type }) => allowedTypes.includes(type));

  return (
    <PhenExNavBarMenu
      isOpen={isOpen}
      onClose={onClose}
      anchorElement={anchorElement}
      menuRef={menuRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      verticalPosition="above"
      horizontalAlignment="center"
      gap={11}
    >
      <div className={localStyles.addMenuContent}>
        <div className={localStyles.itemList}>
          {phenotypeTypes.map(({ type, label }) => (
            <button key={type} onClick={() => dataService.addPhenotype(type)} className={localStyles.addMenuItem}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </PhenExNavBarMenu>
  );
};

// ─── Options Menu (section button context) ─────────────────────────────────────

const OptionsMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  anchorElement: HTMLElement | null;
  menuRef: React.RefObject<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  menuItems: MenuItem[];
}> = ({ isOpen, onClose, anchorElement, menuRef, onMouseEnter, onMouseLeave, menuItems }) => (
  <PhenExNavBarMenu
    isOpen={isOpen}
    onClose={onClose}
    anchorElement={anchorElement}
    menuRef={menuRef}
    className={localStyles.optionsMenu}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    verticalPosition="above"
    horizontalAlignment="center"
  >
    <div className={localStyles.optionsMenuContent}>
      <div className={localStyles.itemList}>
        {menuItems.map(item => (
          <React.Fragment key={item.type}>
            {item.divider && (
              <div className={localStyles.optionsMenuDivider} />
            )}
            <button
              onClick={() => item.onClick?.()}
              className={`${localStyles.addMenuItem} ${localStyles.optionsMenuItemInner}`}
            >
              <span>{item.label}</span>
              <svg width="14" height="14" viewBox="0 0 48 48" fill="none" className={localStyles.optionsMenuArrow}>
                <path d="M14 34L34 14M34 14H14M34 14V34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
              </svg>
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  </PhenExNavBarMenu>
);

// ─── FinalActionNavBar ─────────────────────────────────────────────────────────

export const FinalActionNavBar: React.FC<FinalActionNavBarProps> = ({
  height,
  // view nav
  scrollPercentage = 0,
  canScrollLeft = true,
  canScrollRight = true,
  onViewNavigationArrowClicked,
  onViewNavigationScroll,
  onViewNavigationVisibilityClicked,
  scrollbarTooltipLabel = 'Scroll Through Parameters',
  leftArrowTooltipLabel = 'Go to Previous Parameter',
  rightArrowTooltipLabel = 'Go to Next Parameter',
  flipScrollDirection = false,
  onFlipScrollDirectionChange,
  // call to action
  onSectionTabChange,
  dragHandleRef,
  shadow = false,
  menuItems = [],
  mode = 'cohortviewer',
  onAddButtonClick,
}) => {
  const sections = ['Definition', 'Characteristics', 'Outcomes', 'All'];
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // ── Menu states ─────────────────────────────────────────────────────────────
  const { isOpen: isOptionsMenuOpen, open: openOptionsMenu, close: closeOptionsMenu } = useNavBarMenu('options');
  const { isOpen: isSectionMenuOpen, open: openSectionMenu, close: closeSectionMenu } = useNavBarMenu('section');
  const { isOpen: isAddMenuOpen, open: openAddMenu, close: closeAddMenu } = useNavBarMenu('add');
  const { isOpen: isTooltipOpen, open: openTooltip, close: closeTooltip } = useNavBarMenu('add-tooltip');
  const [isVisibilityMenuOpen, setIsVisibilityMenuOpen] = useState(false);

  // ── Tooltip states ──────────────────────────────────────────────────────────
  const [showLeftArrowTooltip, setShowLeftArrowTooltip] = useState(false);
  const [showRightArrowTooltip, setShowRightArrowTooltip] = useState(false);
  const [showThumbTooltip, setShowThumbTooltip] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const scrollBarRef = useRef<HTMLDivElement>(null);
  const scrollThumbRef = useRef<HTMLDivElement>(null);
  const leftArrowRef = useRef<HTMLButtonElement>(null);
  const rightArrowRef = useRef<HTMLButtonElement>(null);
  const eyeButtonRef = useRef<HTMLButtonElement>(null);
  const visibilityMenuRef = useRef<HTMLDivElement>(null);
  const sectionButtonRef = useRef<HTMLButtonElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sectionMenuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isDraggingRef = useRef(false);
  const isCohortViewer = mode === 'cohortviewer';
  const isStudyViewer = mode === 'studyviewer';

  // ── Scroll drag ─────────────────────────────────────────────────────────────

  const updateScrollPosition = (e: React.MouseEvent | MouseEvent) => {
    if (!scrollBarRef.current) return;
    const rect = scrollBarRef.current.getBoundingClientRect();
    const x = (e as MouseEvent).clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    onViewNavigationScroll?.(percentage);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowThumbTooltip(false);
    isDraggingRef.current = true;
    updateScrollPosition(e);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isDraggingRef.current) updateScrollPosition(moveEvent as any);
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // ── Section helpers ─────────────────────────────────────────────────────────

  const getShuffledSections = () => {
    const shuffled = [...sections];
    const active = shuffled.splice(activeTabIndex, 1)[0];
    return [active, ...shuffled];
  };

  const handleSectionClick = (section: string) => {
    const index = sections.indexOf(section);
    setActiveTabIndex(index);
    onSectionTabChange?.(index);
    closeSectionMenu();
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className={`${localStyles.navBar} ${shadow ? '' : styles.noshadow}`} style={{ height: `${height}px` }}>
      <div className={localStyles.finalActionNavContent}>

        {/* ── Left: view navigation (arrows + scrollbar + eye) ────────────── */}
        <div className={localStyles.navArrowsContainer}>
          <button
            ref={leftArrowRef}
            className={localStyles.navArrowButton}
            onClick={() => { setShowLeftArrowTooltip(false); onViewNavigationArrowClicked?.('left'); }}
            onMouseEnter={() => setShowLeftArrowTooltip(true)}
            onMouseLeave={() => setShowLeftArrowTooltip(false)}
            disabled={!canScrollLeft}
            style={{ opacity: canScrollLeft ? 1 : 0.3, cursor: canScrollLeft ? 'pointer' : 'not-allowed' }}
          >
            <svg width="25" height="28" viewBox="0 0 25 28" fill="none" className={localStyles.navArrowIcon}>
              <path d="M17 23L8.34772 14.0494C8.15571 13.8507 8.16118 13.534 8.35992 13.3422L17 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </button>

          <button
            ref={rightArrowRef}
            className={`${localStyles.navArrowButton} ${localStyles.rightArrowButton}`}
            onClick={() => { setShowRightArrowTooltip(false); onViewNavigationArrowClicked?.('right'); }}
            onMouseEnter={() => setShowRightArrowTooltip(true)}
            onMouseLeave={() => setShowRightArrowTooltip(false)}
            disabled={!canScrollRight}
            style={{ opacity: canScrollRight ? 1 : 0.3, cursor: canScrollRight ? 'pointer' : 'not-allowed' }}
          >
            <svg width="25" height="28" viewBox="0 0 25 28" fill="none" className={localStyles.rightArrowIcon}>
              <path d="M17 23L8.34772 14.0494C8.15571 13.8507 8.16118 13.534 8.35992 13.3422L17 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={localStyles.horizontalScrollContainer}>
          <div
            ref={scrollBarRef}
            className={localStyles.horizontalScrollbar}
            onMouseDown={handleMouseDown}
            onMouseEnter={() => setShowThumbTooltip(true)}
            onMouseLeave={() => setShowThumbTooltip(false)}
          >
            <div
              ref={scrollThumbRef}
              className={localStyles.scrollbarThumb}
              style={{ left: `${scrollPercentage}%` }}
            />
          </div>
        </div>

        <button
          ref={eyeButtonRef}
          className={localStyles.eyeButton}
          onMouseEnter={() => setIsVisibilityMenuOpen(true)}
          onMouseLeave={() => {
            setTimeout(() => {
              if (!visibilityMenuRef.current?.matches(':hover')) setIsVisibilityMenuOpen(false);
            }, 100);
          }}
          onClick={() => setIsVisibilityMenuOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>


        {/* ── Right: section button + add button ───────────────────────────── */}
        <div ref={dragHandleRef} data-drag-handle className={localStyles.dragHandle} />

        <button
          ref={sectionButtonRef}
          className={`${localStyles.sectionButton} ${localStyles.sectionButtonWrapper}`}
          onMouseEnter={openSectionMenu}
          onMouseLeave={() => {
            setTimeout(() => {
              if (!sectionMenuRef.current?.matches(':hover')) closeSectionMenu();
            }, 100);
          }}
          onClick={openSectionMenu}
        >
          {sections[activeTabIndex]}
        </button>

        <button
          ref={addButtonRef}
          className={localStyles.addButton}
          onMouseEnter={() => {
            if (isCohortViewer) openAddMenu();
            else if (isStudyViewer) openTooltip();
          }}
          onMouseLeave={() => {
            if (isCohortViewer) {
              setTimeout(() => {
                if (!addMenuRef.current?.matches(':hover')) closeAddMenu();
              }, 100);
            } else if (isStudyViewer) {
              closeTooltip();
            }
          }}
          onClick={() => {
            if (isCohortViewer) openAddMenu();
            else if (isStudyViewer) onAddButtonClick?.();
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* ── Tooltips ────────────────────────────────────────────────────────── */}
      <PhenExNavBarTooltip isVisible={showLeftArrowTooltip && canScrollLeft} anchorElement={leftArrowRef.current} verticalPosition="above" label={leftArrowTooltipLabel} gap={12} />
      <PhenExNavBarTooltip isVisible={showRightArrowTooltip && canScrollRight} anchorElement={rightArrowRef.current} label={rightArrowTooltipLabel} verticalPosition="above" gap={12} />
      <PhenExNavBarTooltip isVisible={showThumbTooltip} anchorElement={scrollThumbRef.current} label={scrollbarTooltipLabel} verticalPosition="above" gap={14} />

      {/* ── Menus ────────────────────────────────────────────────────────────── */}
      <VisibilityMenu
        isOpen={isVisibilityMenuOpen}
        onClose={() => setIsVisibilityMenuOpen(false)}
        anchorElement={eyeButtonRef.current}
        menuRef={visibilityMenuRef}
        onMouseEnter={() => setIsVisibilityMenuOpen(true)}
        onMouseLeave={() => setIsVisibilityMenuOpen(false)}
        flipScrollDirection={flipScrollDirection}
        onFlipScrollDirectionChange={onFlipScrollDirectionChange ?? (() => {})}
      />

      <PhenExNavBarMenu
        isOpen={isSectionMenuOpen}
        onClose={closeSectionMenu}
        anchorElement={sectionButtonRef.current}
        menuRef={sectionMenuRef}
        onMouseEnter={openSectionMenu}
        onMouseLeave={closeSectionMenu}
        verticalPosition="above"
        horizontalAlignment="center"
        gap={11}
      >
        <div className={localStyles.sectionMenuContent}>
          <div className={localStyles.itemList}>
            {getShuffledSections().map(section => (
              <button key={section} onClick={() => handleSectionClick(section)} className={localStyles.addMenuItem}>
                {section}
              </button>
            ))}
          </div>
        </div>
      </PhenExNavBarMenu>

      <OptionsMenu
        isOpen={isOptionsMenuOpen}
        onClose={closeOptionsMenu}
        anchorElement={optionsButtonRef.current}
        menuRef={menuRef}
        onMouseEnter={openOptionsMenu}
        onMouseLeave={closeOptionsMenu}
        menuItems={menuItems}
      />

      {isCohortViewer && (
        <AddMenu
          isOpen={isAddMenuOpen}
          onClose={closeAddMenu}
          anchorElement={addButtonRef.current}
          menuRef={addMenuRef}
          onMouseEnter={openAddMenu}
          onMouseLeave={closeAddMenu}
          activeSection={sections[activeTabIndex]}
        />
      )}

      {isStudyViewer && (
        <PhenExNavBarMenu
          isOpen={isTooltipOpen}
          onClose={closeTooltip}
          anchorElement={addButtonRef.current}
          menuRef={tooltipRef}
          verticalPosition="above"
          horizontalAlignment="center"
          gap={11}
        >
          <div className={localStyles.addCohortTooltip}>
            Add a cohort
          </div>
        </PhenExNavBarMenu>
      )}
    </div>
  );
};
