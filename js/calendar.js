/**
 * QuickSee - Calendar & Milestone Management Engine
 * Handles Month grid computation, Agenda groupings, overdue calculations, and timezone support.
 */

export function getAllMilestones(cryptoProjects = [], games = []) {
  const milestones = [];
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const pushMilestone = (record, category, milestoneType, dateStr) => {
    if (!dateStr) return;
    const isCompleted = ['Completed', 'Dropped', 'Listed', 'Claimable', 'Live'].includes(record.status);
    const isOverdue = dateStr < todayStr && !isCompleted;
    
    // Relative days calculation
    const targetDate = new Date(dateStr + 'T00:00:00');
    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = targetDate.getTime() - todayZero.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    let relativeLabel = '';
    if (diffDays < 0) {
      relativeLabel = `Overdue by ${Math.abs(diffDays)}d`;
    } else if (diffDays === 0) {
      relativeLabel = 'Today';
    } else if (diffDays === 1) {
      relativeLabel = 'Tomorrow';
    } else {
      relativeLabel = `In ${diffDays}d`;
    }

    milestones.push({
      id: `${record.id}_${milestoneType}_${dateStr}`,
      recordId: record.id,
      recordName: record.name,
      category, // 'crypto' | 'game'
      subType: record.type || 'Game', // 'Whitelist' | 'Airdrop' | 'Game'
      milestoneType, // 'TGE / Release' | 'Claim' | 'Listing' | 'Game Launch'
      date: dateStr,
      dateConfidence: record.dateConfidence || 'Estimated',
      status: record.status,
      network: record.network || '',
      tokenSymbol: record.tokenSymbol || '',
      contractAddress: record.contractAddress || '',
      isOverdue,
      diffDays,
      relativeLabel,
      record
    });
  };

  cryptoProjects.forEach(p => {
    if (p.releaseDate) pushMilestone(p, 'crypto', 'TGE / Release', p.releaseDate);
    if (p.claimDate) pushMilestone(p, 'crypto', 'Claim', p.claimDate);
    if (p.listingDate) pushMilestone(p, 'crypto', 'Listing', p.listingDate);
  });

  games.forEach(g => {
    if (g.gameReleaseDate) pushMilestone(g, 'game', 'Game Launch', g.gameReleaseDate);
    if (g.tokenReleaseDate) pushMilestone(g, 'game', 'Token TGE', g.tokenReleaseDate);
  });

  // Sort by date ascending
  milestones.sort((a, b) => a.date.localeCompare(b.date));
  return milestones;
}

export function generateMonthGrid(year, month, milestones = []) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon ...
  const totalDaysInMonth = lastDay.getDate();

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const cells = [];

  // Previous month trailing days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const prevMonthDate = new Date(year, month - 1, dayNum);
    const dateStr = prevMonthDate.toISOString().split('T')[0];
    cells.push({
      dayNum,
      dateStr,
      isCurrentMonth: false,
      isToday: false,
      events: milestones.filter(m => m.date === dateStr)
    });
  }

  // Current month days
  const todayStr = new Date().toISOString().split('T')[0];
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const curDate = new Date(year, month, d);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      dayNum: d,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      events: milestones.filter(m => m.date === dateStr)
    });
  }

  // Next month leading days to complete grid (up to 35 or 42)
  const remainingCells = (7 - (cells.length % 7)) % 7;
  for (let n = 1; n <= remainingCells; n++) {
    const nextMonthDate = new Date(year, month + 1, n);
    const dateStr = nextMonthDate.toISOString().split('T')[0];
    cells.push({
      dayNum: n,
      dateStr,
      isCurrentMonth: false,
      isToday: false,
      events: milestones.filter(m => m.date === dateStr)
    });
  }

  return cells;
}

export function groupMilestonesByAgenda(milestones = []) {
  const groups = {
    overdue: [],
    todayAndTomorrow: [],
    thisWeek: [],
    thisMonth: [],
    later: []
  };

  milestones.forEach(m => {
    if (m.isOverdue) {
      groups.overdue.push(m);
    } else if (m.diffDays >= 0 && m.diffDays <= 1) {
      groups.todayAndTomorrow.push(m);
    } else if (m.diffDays > 1 && m.diffDays <= 7) {
      groups.thisWeek.push(m);
    } else if (m.diffDays > 7 && m.diffDays <= 30) {
      groups.thisMonth.push(m);
    } else if (m.diffDays > 30) {
      groups.later.push(m);
    }
  });

  return groups;
}
