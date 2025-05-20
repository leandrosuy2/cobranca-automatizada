import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('controle_emails')
export class ControleEmails {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cliente_id: number;

  @Column({ type: 'date' })
  data_envio: Date;

  @CreateDateColumn()
  created_at: Date;
} 