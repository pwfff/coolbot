import { RegisterHandler } from '../src/bot';

enum UserLevel {
  '',
  '+',
  '%',
  '@',
  '&',
  '~',
}

type Document = {
  _id: string;
  _deleted?: boolean;
  _rev: string;
  doc_type: string;
};

type User = {
  nickname: string;
  hostmask?: string;
  level: UserLevel;
};

type UserUpdate = Partial<User>;

type Channel = {
  name: string;
  topic?: string;
  createdAt: number;
  users: { [nickname: string]: User };
} & Document;

type ChannelUpdate = Partial<Omit<Channel, '_id' | 'doc_type'>>;

export const register: RegisterHandler = ({ registerEventHandler }) => {};

export class PersistenceHelper {
  constructor(private database: PouchDB.Database, private clientName: string) {}

  async fetchChannel(channelName: string): Promise<Channel> {
    const id = this.createID(channelName);

    return this.database.get<Channel>(id);
  }

  async addchannel(data: Omit<Channel, keyof Document>) {
    try {
      await this.fetchChannel(data.name);

      throw new Error('Channel already exists');
    } catch (e) {
      const id = this.createID(data.name);

      this.database.put({ ...data, _id: id, doc_type: 'irc-channel' });
    }
  }

  async deleteChannel(channelName: string) {
    const channel = await this.fetchChannel(channelName);

    const deletedChannel = { ...channel, _deleted: true };

    this.updateChannel(channelName, deletedChannel);
  }

  async updateChannel(
    channelName: string,
    update: ChannelUpdate,
  ): Promise<Channel> {
    const channel = await this.fetchChannel(channelName);

    const updatedChannel = { ...channel, ...update };

    await this.database.put<Channel>(updatedChannel);

    return this.fetchChannel(channelName);
  }

  async addUser(channelName: string, user: User) {
    const channel = await this.fetchChannel(channelName);

    channel.users[user.nickname] = user;

    this.database.put(channel);
  }

  async deleteUser(channelName: string, nickname: string) {
    const channel = await this.fetchChannel(channelName);

    delete channel.users[nickname];

    this.updateChannel(channelName, channel);
  }

  async fetchUser(
    channelName: string,
    nickname: string,
  ): Promise<User | undefined> {
    const channel = await this.fetchChannel(channelName);

    return channel.users[nickname];
  }

  async updateUser(
    channelName: string,
    nickname: string,
    update: UserUpdate,
  ): Promise<User> {
    const user = await this.fetchUser(channelName, nickname);
    const channel = await this.fetchChannel(channelName);

    if (!user) {
      throw new Error(`Missing user ${nickname}`);
    }

    if (!channel) {
      throw new Error(`Missing channel ${channel}`);
    }

    const channelUpdate = {
      users: { ...channel.users, [user.nickname]: { ...user, ...update } },
    };

    const updatedChannel = await this.updateChannel(channelName, channelUpdate);

    return updatedChannel.users[nickname];
  }

  private createID(name: string): string {
    return `channel:${this.clientName}:${name}`;
  }
}
