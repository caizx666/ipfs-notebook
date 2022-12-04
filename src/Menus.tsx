import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  EditOutlined,
  SmileOutlined,
} from '@ant-design/icons';
import { Button, ConfigProvider, List, Input } from 'antd';
import dayjs from 'dayjs';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './Data';
import './Menus.less';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useEffect, useRef, useState } from 'react';
import VirtualList, { ListRef } from 'rc-virtual-list';
dayjs.extend(relativeTime);

const customizeRenderEmpty = () => (
  <div style={{ textAlign: 'center' }}>
    <SmileOutlined style={{ fontSize: 20 }} />
    <p>暂无日志</p>
  </div>
);

const reg = /<[^>]+>/gim;
const regP = /<p(?:(?!<\/p>).|\n)*?<\/p>/gm;

function getContainerHeight() {
  return window.innerHeight - 41;
}

const itemHeight = 73;

function getBestCount() {
  return Math.ceil((getContainerHeight() / itemHeight) * 1.5);
}

let lastActiveNoteId: number | undefined;

export default function ({
  bookVisible,
  onBookVisibleChange,
  onCreateBook,
}: {
  bookVisible: boolean;
  onCreateBook: (mode: string) => void;
  onBookVisibleChange: (visible: boolean) => void;
}) {
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [limit, setLimit] = useState(getBestCount());
  const activeNote = useLiveQuery(() => db.getActiveNote());
  const activeBook = useLiveQuery(() => db.getActiveBook(), []);
  const listRef = useRef<ListRef>(null);
  const bookMenus = useLiveQuery(async () => {
    return (
      await db.notes
        .filter(
          (note) =>
            note.bookId === activeBook?.id &&
            (searchText && searchVisible
              ? note.content.includes(searchText) || false
              : true)
        )
        .limit(limit)
        .reverse()
        .sortBy('updateAt')
    ).map((it) => {
      const txts = it.content.match(regP) || [];
      return {
        noteId: it.id,
        title: (txts[0] || '').replace(reg, ''),
        lastAt: it.updateAt || it.createAt || it.deleteAt,
        summary: txts?.slice(1).join('\n').replace(reg, '').substring(0, 20),
      };
    });
  }, [activeBook, searchText, searchVisible, limit]);

  useEffect(() => {
    setLimit(getBestCount());
  }, [activeBook?.id]);

  useEffect(() => {
    if (lastActiveNoteId === activeNote?.id) {
      listRef.current?.scrollTo(0);
    }
    lastActiveNoteId = activeNote?.id;
  }, [activeNote?.updateAt]);

  async function addNewNote() {
    if (!activeBook) {
      return onCreateBook('add');
    }
    await db.upsertNote('');
  }

  function onScroll(e) {
    if (
      e.currentTarget.scrollHeight - e.currentTarget.scrollTop ===
      getContainerHeight()
    ) {
      setLimit(limit + getBestCount());
    }
  }

  return (
    <ConfigProvider renderEmpty={customizeRenderEmpty}>
      <List
        className="ipfs-menus"
        header={
          <>
            <div className="btns">
              <Button
                type="text"
                title="记事本列表"
                icon={
                  bookVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />
                }
                onClick={(e) => onBookVisibleChange(!bookVisible)}
              ></Button>
              <Button
                type="text"
                className="right"
                title="搜索文本"
                icon={<SearchOutlined />}
                onClick={() => setSearchVisible(!searchVisible)}
              ></Button>
              <Button
                type="text"
                className="right"
                title="新增文本"
                icon={<EditOutlined />}
                onClick={() => addNewNote()}
              ></Button>
            </div>
            {searchVisible && (
              <Input.Search
                size="small"
                placeholder="输入查找内容..."
                onSearch={(v) => setSearchText(v)}
              />
            )}
          </>
        }
      >
        {bookMenus && bookMenus.length > 0 && (
          <VirtualList
            ref={listRef}
            data={bookMenus}
            height={getContainerHeight()}
            itemHeight={itemHeight}
            itemKey="noteId"
            onScroll={onScroll}
          >
            {(item) => (
              <List.Item onClick={() => db.activeNote(item.noteId!)}>
                <List.Item.Meta
                  className={item.noteId === activeNote?.id ? 'active' : ''}
                  title={<a title={item.title}>{item.title || '无标题'}</a>}
                  description={
                    <>
                      <span className="datetime">
                        {dayjs(item.lastAt).locale('zh-cn').fromNow()}
                      </span>
                      <span>{item.summary}</span>
                    </>
                  }
                />
              </List.Item>
            )}
          </VirtualList>
        )}
      </List>
    </ConfigProvider>
  );
}
