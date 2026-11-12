import type { ReadingLocator } from '../reading/domain/models';
import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<RootTabParamList> | undefined;
  Study: undefined;
  WrongWords: undefined;
  WordDetail: { wordId: string };
};

export type RootTabParamList = {
  HomeTab: undefined;
  ReadingTab: NavigatorScreenParams<ReadingStackParamList> | undefined;
  PlanTab: undefined;
  FavoritesTab: undefined;
  SettingsTab: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
};

export type ReadingStackParamList = {
  Library: undefined;
  BookDetail: { bookId: string };
  Reader: { bookId: string; locator?: ReadingLocator };
};

export type FavoritesStackParamList = {
  Favorites: undefined;
  FavoritesWordDetail: { wordId: string };
};

export type PlanStackParamList = {
  Plan: undefined;
};

export type SettingsStackParamList = {
  Settings: undefined;
};
