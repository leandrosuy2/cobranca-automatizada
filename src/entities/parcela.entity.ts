import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Contrato } from './contrato.entity';

@Entity('parcelas')
export class Parcela {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'contrato_id' })
  contrato_id: number;

  @ManyToOne(() => Contrato)
  @JoinColumn({ name: 'contrato_id' })
  contrato: Contrato;

  @Column()
  numero_parcela: number;

  @Column('decimal', { precision: 10, scale: 2 })
  valor: number;

  @Column({ name: 'data_vencimento', type: 'date' })
  data_vencimento: Date;

  @Column({ name: 'data_pagamento', type: 'date', nullable: true })
  data_pagamento: Date;

  @Column({ name: 'status', length: 20, default: 'pendente' })
  status: string;

  @Column({ name: 'valor_pago', type: 'decimal', precision: 10, scale: 2, nullable: true })
  valor_pago: number;

  @Column({ name: 'forma_pagamento', length: 20, nullable: true })
  forma_pagamento: string;

  @Column({ name: 'payment_id', nullable: true })
  payment_id: string;

  @Column({ name: 'observacao', type: 'text', nullable: true })
  observacao: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
} 