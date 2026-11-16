// チームの決まりのテスト。

import { describe, expect, it } from 'vitest';
import {
  addMember,
  createTeam,
  duplicateTeam,
  isTeamFull,
  moveItem,
  moveMember,
  normalizeTeam,
  removeMember,
  renameTeam,
  teamsContaining,
} from './team.ts';

const teamOf = (...ids: string[]) => ({ ...createTeam('テスト', 0), memberIds: ids });

describe('addMember: 最大6体、同じ個体は1回だけ', () => {
  it('足せる', () => {
    expect(addMember(teamOf('a'), 'b').memberIds).toEqual(['a', 'b']);
  });
  it('6体までは足せて、7体目は足せない', () => {
    const six = teamOf('a', 'b', 'c', 'd', 'e', 'f');
    expect(isTeamFull(teamOf('a', 'b', 'c', 'd', 'e'))).toBe(false);
    expect(isTeamFull(six)).toBe(true);
    expect(addMember(six, 'g').memberIds).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
  it('すでに入っている個体は足せない', () => {
    expect(addMember(teamOf('a'), 'a').memberIds).toEqual(['a']);
  });
  it('元のチームは書き換えない', () => {
    const team = teamOf('a');
    addMember(team, 'b');
    expect(team.memberIds).toEqual(['a']);
  });
});

describe('removeMember', () => {
  it('外せる', () => {
    expect(removeMember(teamOf('a', 'b', 'c'), 'b').memberIds).toEqual(['a', 'c']);
  });
  it('入っていない個体を指定しても、何も変わらない', () => {
    const team = teamOf('a');
    expect(removeMember(team, 'x')).toBe(team);
  });
});

describe('moveItem / moveMember: 並べ替え', () => {
  it('1つ上へ', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
  });
  it('1つ下へ', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });
  it('離れた位置へ', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'd', 'a']);
  });
  it('範囲の外を指定しても、何も変わらない', () => {
    expect(moveItem(['a', 'b'], 0, 2)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
  });
  it('メンバーの並べ替え', () => {
    expect(moveMember(teamOf('a', 'b', 'c'), 0, 2).memberIds).toEqual(['b', 'c', 'a']);
  });
});

describe('renameTeam', () => {
  it('前後の空白を取る', () => {
    expect(renameTeam(teamOf(), '  雨パ  ').name).toBe('雨パ');
  });
  it('30文字まで', () => {
    expect(renameTeam(teamOf(), 'あ'.repeat(40)).name).toBe('あ'.repeat(30));
  });
});

describe('duplicateTeam', () => {
  it('名前に「のコピー」が付き、メンバーは同じ、id は別', () => {
    const source = { ...teamOf('a', 'b'), name: '雨パ' };
    const copy = duplicateTeam(source, 5);
    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe('雨パ のコピー');
    expect(copy.memberIds).toEqual(['a', 'b']);
    expect(copy.order).toBe(5);
    copy.memberIds.push('c');
    expect(source.memberIds).toEqual(['a', 'b']); // 複製を変えても元は変わらない
  });
});

describe('teamsContaining / normalizeTeam', () => {
  it('その個体が入っているチームだけを返す', () => {
    const teams = [teamOf('a', 'b'), teamOf('c'), teamOf('b')];
    expect(teamsContaining(teams, 'b').length).toBe(2);
    expect(teamsContaining(teams, 'x')).toEqual([]);
  });
  it('足りない項目を補う', () => {
    expect(normalizeTeam({ id: 't' })).toMatchObject({ name: '', memberIds: [], order: 0 });
  });
});
